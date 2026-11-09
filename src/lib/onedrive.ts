import "server-only";
import { randomUUID, createCipheriv, createDecipheriv } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type OneDriveFailure =
  | "not_connected"
  | "configuration"
  | "reconnect"
  | "permissions"
  | "quota"
  | "request_failed";

export class OneDriveError extends Error {
  constructor(readonly failure: OneDriveFailure, readonly status?: number) {
    super(`Microsoft OneDrive operation failed: ${failure}${status ? ` (${status})` : ""}`);
    this.name = "OneDriveError";
  }
}

function encryptionKey() {
  const encoded =
    process.env.STORAGE_TOKEN_ENCRYPTION_KEY ||
    process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY;
  if (!encoded) throw new OneDriveError("configuration");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new OneDriveError("configuration");
  return key;
}

export function encryptOneDriveToken(token: string) {
  const iv = randomUUID().replaceAll("-", "").slice(0, 24);
  const ivBytes = Buffer.from(iv, "hex");
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), ivBytes);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return `${ivBytes.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptOneDriveToken(encrypted: string) {
  const [iv, tag, ciphertext] = encrypted.split(".");
  if (!iv || !tag || !ciphertext) throw new Error("Stored Microsoft OneDrive token is invalid");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

export async function getOneDriveAccessToken(
  supabase: SupabaseClient,
  workspaceId: string,
  organizationId?: string
): Promise<string> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new OneDriveError("configuration");

  let refreshTokenCiphertext: string | null = null;
  let isWorkspaceLevel = false;

  // 1. Check workspace config
  if (workspaceId) {
    const { data: wsCfg } = await supabase
      .from("workspace_storage_configs")
      .select("onedrive_refresh_token_ciphertext")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (wsCfg?.onedrive_refresh_token_ciphertext) {
      refreshTokenCiphertext = wsCfg.onedrive_refresh_token_ciphertext;
      isWorkspaceLevel = true;
    }
  }

  // 2. Check organization config fallback
  if (!refreshTokenCiphertext && organizationId) {
    const { data: orgCfg } = await supabase
      .from("organization_storage_configs")
      .select("onedrive_refresh_token_ciphertext")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (orgCfg?.onedrive_refresh_token_ciphertext) {
      refreshTokenCiphertext = orgCfg.onedrive_refresh_token_ciphertext;
    }
  }

  if (!refreshTokenCiphertext) {
    throw new OneDriveError("not_connected");
  }

  const refreshToken = decryptOneDriveToken(refreshTokenCiphertext);
  const tokenUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new OneDriveError("reconnect", response.status);
  }

  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
  };

  if (!payload.access_token) {
    throw new Error("Microsoft did not return an access token");
  }

  // If Microsoft rotated the refresh token, store the new one
  if (payload.refresh_token && payload.refresh_token !== refreshToken) {
    const newEncrypted = encryptOneDriveToken(payload.refresh_token);
    if (isWorkspaceLevel && workspaceId) {
      await supabase
        .from("workspace_storage_configs")
        .update({ onedrive_refresh_token_ciphertext: newEncrypted, updated_at: new Date().toISOString() })
        .eq("workspace_id", workspaceId);
    } else if (organizationId) {
      await supabase
        .from("organization_storage_configs")
        .update({ onedrive_refresh_token_ciphertext: newEncrypted, updated_at: new Date().toISOString() })
        .eq("organization_id", organizationId);
    }
  }

  return payload.access_token;
}

export type OneDriveUploadedFile = {
  id: string;
  name: string;
  size: number;
  webUrl: string;
  downloadUrl?: string;
};

export async function uploadProjectOneDriveFile(
  accessToken: string,
  folderPath: string,
  fileName: string,
  contentType: string,
  fileBytes: Uint8Array
): Promise<OneDriveUploadedFile> {
  const cleanParts = folderPath
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  const folder = cleanParts.length > 0 ? cleanParts.join("/") : "Orbitwork";
  const safeName = fileName.replace(/[\\/:*?"<>|]/g, "_").trim() || "file";
  const itemPath = `${folder}/${safeName}`;
  const encodedPath = itemPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  // For files <= 4MB, use simple direct PUT
  if (fileBytes.byteLength <= 4 * 1024 * 1024) {
    const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}:/content`;
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": contentType || "application/octet-stream",
      },
      body: Buffer.from(fileBytes),
      cache: "no-store",
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`OneDrive upload failed (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as {
      id: string;
      name: string;
      size: number;
      webUrl: string;
      "@microsoft.graph.downloadUrl"?: string;
    };

    return {
      id: data.id,
      name: data.name,
      size: data.size,
      webUrl: data.webUrl,
      downloadUrl: data["@microsoft.graph.downloadUrl"],
    };
  }

  // For files > 4MB (up to 15MB), use an upload session
  const sessionUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}:/createUploadSession`;
  const sessionRes = await fetch(sessionUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      item: {
        "@microsoft.graph.conflictBehavior": "rename",
        name: safeName,
      },
    }),
    cache: "no-store",
  });

  if (!sessionRes.ok) {
    const errText = await sessionRes.text().catch(() => "");
    throw new Error(`OneDrive upload session creation failed (${sessionRes.status}): ${errText}`);
  }

  const session = (await sessionRes.json()) as { uploadUrl: string };
  const uploadResponse = await fetch(session.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Length": fileBytes.byteLength.toString(),
      "Content-Range": `bytes 0-${fileBytes.byteLength - 1}/${fileBytes.byteLength}`,
    },
    body: Buffer.from(fileBytes),
    cache: "no-store",
  });

  if (!uploadResponse.ok) {
    const errText = await uploadResponse.text().catch(() => "");
    throw new Error(`OneDrive chunk upload failed (${uploadResponse.status}): ${errText}`);
  }

  const uploadedData = (await uploadResponse.json()) as {
    id: string;
    name: string;
    size: number;
    webUrl: string;
    "@microsoft.graph.downloadUrl"?: string;
  };

  return {
    id: uploadedData.id,
    name: uploadedData.name,
    size: uploadedData.size,
    webUrl: uploadedData.webUrl,
    downloadUrl: uploadedData["@microsoft.graph.downloadUrl"],
  };
}

export async function getOneDriveFile(accessToken: string, fileId: string) {
  const metadataRes = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(fileId)}?select=id,name,size,webUrl,@microsoft.graph.downloadUrl`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );

  if (!metadataRes.ok) throw new Error("Could not retrieve OneDrive file metadata");
  const metadata = (await metadataRes.json()) as {
    id: string;
    name: string;
    size: number;
    webUrl: string;
    "@microsoft.graph.downloadUrl"?: string;
  };

  const downloadUrl = metadata["@microsoft.graph.downloadUrl"];
  const contentRes = await fetch(
    downloadUrl || `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(fileId)}/content`,
    {
      headers: downloadUrl ? {} : { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );

  if (!contentRes.ok) throw new Error("Could not download file content from OneDrive");
  const buffer = Buffer.from(await contentRes.arrayBuffer());
  return { metadata, buffer };
}

export async function deleteOneDriveFile(accessToken: string, fileId: string) {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(fileId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );
  if (!response.ok && response.status !== 404) {
    throw new Error("Could not delete file from OneDrive");
  }
}
