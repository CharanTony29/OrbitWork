import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSchemaMissingError } from "@/lib/chat";
import { getUserActiveOrgIds, noStoreJson } from "@/lib/chat-server";
import {
  getOrgChatCloudPolicy,
  getUserApplicableOrgPolicies,
  getUserPersonalCloudConnections,
  uploadChatFileToPersonalCloud,
  validateAccountAgainstPolicies,
  validateAccountAgainstPolicy,
} from "@/lib/personal-cloud";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHAT_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB (stored in sender's personal Drive/OneDrive, NOT Supabase)

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return noStoreJson({ error: "Unauthorized" }, 401);
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const orgIdRaw = formData.get("organizationId");
    const orgParam = typeof orgIdRaw === "string" ? orgIdRaw.trim() : null;

    if (!(file instanceof File)) {
      return noStoreJson({ error: "Missing file." }, 400);
    }
    if (file.size <= 0) {
      return noStoreJson({ error: "Uploaded file is empty." }, 400);
    }
    if (file.size > MAX_CHAT_UPLOAD_BYTES) {
      return noStoreJson(
        { error: "File exceeds the 15 MB chat upload limit." },
        413
      );
    }

    const activeOrgIds = await getUserActiveOrgIds(supabase, user.id);
    const resolvedOrgId =
      orgParam && activeOrgIds.includes(orgParam)
        ? orgParam
        : activeOrgIds[0] ?? null;

    // 1. Check user's personal Google Drive / OneDrive connections (NEVER store chat files in Supabase)
    const { connections, migrationMissing } = await getUserPersonalCloudConnections(supabase, user.id);

    if (migrationMissing) {
      return noStoreJson(
        {
          ok: false,
          migrationMissing: true,
          needsCloudConnection: true,
          error:
            "Personal cloud storage migration is not applied yet. Please apply supabase/migrations/202611180001_user_prefs_personal_cloud_inbox.sql and connect your personal Google Drive or OneDrive in Profile Settings.",
        },
        503
      );
    }

    if (connections.length === 0) {
      return noStoreJson(
        {
          ok: false,
          needsCloudConnection: true,
          error:
            "Please connect your personal Google Drive or OneDrive in Profile Settings before sending files in chat. Chat files are kept private in your own cloud drive and are never stored in Supabase.",
        },
        422
      );
    }

    // 2. Enforce organization-wide cloud storage policy (e.g. *@myorg.com or OneDrive-only)
    const applicablePolicies = resolvedOrgId
      ? [await getOrgChatCloudPolicy(supabase, resolvedOrgId)]
      : await getUserApplicableOrgPolicies(supabase, user.id);

    const activeConn = connections.find((c) => c.is_active) ?? connections[0];
    let selectedConn = activeConn;

    const primaryCheck = resolvedOrgId
      ? validateAccountAgainstPolicy(activeConn.provider, activeConn.account_email, applicablePolicies[0])
      : validateAccountAgainstPolicies(activeConn.provider, activeConn.account_email, applicablePolicies);

    if (!primaryCheck.ok) {
      // Check if user's other connected personal provider complies with the org policy
      const compliantAlternative = connections.find((conn) => {
        if (conn.id === activeConn.id) return false;
        const check = resolvedOrgId
          ? validateAccountAgainstPolicy(conn.provider, conn.account_email, applicablePolicies[0])
          : validateAccountAgainstPolicies(conn.provider, conn.account_email, applicablePolicies);
        return check.ok;
      });

      if (compliantAlternative) {
        selectedConn = compliantAlternative;
      } else {
        return noStoreJson(
          {
            ok: false,
            policyViolation: true,
            needsCloudConnection: true,
            error: `${primaryCheck.reason} Update your connected account in Profile Settings to share files.`,
          },
          403
        );
      }
    }

    // 3. Upload bytes directly into the sender's personal Google Drive or OneDrive ("Orbitwork Chat" folder)
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";
    const fileName = (file.name || "attachment").slice(0, 180);

    let uploaded: { provider: "google_drive" | "onedrive"; externalFileId: string };
    try {
      uploaded = await uploadChatFileToPersonalCloud(
        supabase,
        selectedConn,
        fileName,
        mimeType,
        new Uint8Array(buffer)
      );
    } catch (cloudErr) {
      console.error("Personal cloud upload failed:", cloudErr);
      return noStoreJson(
        {
          ok: false,
          needsCloudConnection: true,
          error:
            "Could not upload to your connected personal cloud drive. Please reconnect Google Drive or OneDrive in Profile Settings and try again.",
        },
        502
      );
    }

    // 4. Save metadata pointer ONLY in chat_attachments (file_bytes = null -> zero Supabase storage usage!)
    const { data: created, error } = await supabase
      .from("chat_attachments")
      .insert({
        uploader_id: user.id,
        organization_id: resolvedOrgId,
        file_name: fileName,
        mime_type: mimeType,
        file_size_bytes: file.size,
        file_bytes: null,
        storage_provider: uploaded.provider,
        external_file_id: uploaded.externalFileId,
        owner_user_id: user.id,
      })
      .select("id, file_name, mime_type, file_size_bytes, storage_provider, created_at")
      .single();

    if (error) {
      if (isSchemaMissingError(error)) {
        return noStoreJson(
          {
            ok: false,
            migrationMissing: true,
            error:
              "Chat attachments schema needs the latest migration (202611180001_user_prefs_personal_cloud_inbox.sql) to store personal cloud pointers.",
          },
          503
        );
      }
      return noStoreJson({ error: error.message }, 500);
    }

    return noStoreJson(
      {
        ok: true,
        attachment: {
          id: created.id,
          fileName: created.file_name,
          mimeType: created.mime_type,
          fileSizeBytes: created.file_size_bytes,
          storageProvider: created.storage_provider,
          url: `/api/chat/attachments/${created.id}`,
        },
      },
      201
    );
  } catch (err) {
    console.error("Chat attachment upload error:", err);
    return noStoreJson({ error: "Failed to upload chat attachment." }, 500);
  }
}
