import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  buildChannelThreadKey,
  buildDirectThreadKey,
  buildGroupThreadKey,
  isSchemaMissingError,
  stripMarkdownForPreview,
  type ChatMessageMetadata,
} from "@/lib/chat";
import {
  CHAT_SELECT_BASE,
  CHAT_SELECT_EXTENDED,
  fetchProfilesMap,
  formatHydratedMessage,
  getUserActiveOrgIds,
  hydrateReactionsMap,
  noStoreJson,
  touchUserPresence,
  type RawChatRow,
} from "@/lib/chat-server";

export const dynamic = "force-dynamic";

const MAX_MESSAGE_FETCH = 250;

const linkedEntitySchema = z.object({
  kind: z.enum(["task", "project", "document"]),
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(240),
  href: z.string().min(1).max(400),
  subtitle: z.string().max(160).optional(),
});

const attachmentSchema = z.object({
  id: z.string().min(1).max(120),
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(120),
  fileSizeBytes: z.number().nonnegative().max(15_000_000),
  url: z.string().min(1).max(500),
});

const postBodySchema = z.object({
  type: z.enum(["channel", "direct", "group"]).default("channel"),
  target: z.string().trim().min(1).max(120),
  organizationId: z.string().uuid().optional().nullable(),
  workspaceId: z.string().uuid().optional().nullable(),
  message: z.string().trim().min(1).max(8000),
  replyToId: z.string().uuid().optional().nullable(),
  metadata: z
    .object({
      linkedEntities: z.array(linkedEntitySchema).max(6).optional(),
      attachments: z.array(attachmentSchema).max(8).optional(),
    })
    .optional(),
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveThreadKeyFromRow(row: RawChatRow, fallbackOrgId: string | null): string {
  if (row.thread_id) {
    return buildGroupThreadKey(row.thread_id);
  }
  if (row.recipient_id) {
    return buildDirectThreadKey(row.sender_id, row.recipient_id);
  }
  return buildChannelThreadKey(row.channel || "general", row.organization_id ?? fallbackOrgId);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return noStoreJson({ error: "Unauthorized" }, 401);
    }

    const { searchParams } = new URL(request.url);
    const type = (searchParams.get("type") || "channel") as "channel" | "direct" | "group" | "latest";
    const target = (searchParams.get("target") || "general").trim();
    const orgParam = searchParams.get("organizationId")?.trim() || null;

    let enhancedMigrationMissing = false;
    let rows: RawChatRow[] = [];

    if (type === "latest") {
      // Fetch recent incoming messages from colleagues (not own sent messages)
      const sinceIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const extRes = await supabase
        .from("workspace_chat_messages")
        .select(CHAT_SELECT_EXTENDED)
        .neq("sender_id", user.id)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(80);

      if (extRes.error && isSchemaMissingError(extRes.error)) {
        enhancedMigrationMissing = true;
        const baseRes = await supabase
          .from("workspace_chat_messages")
          .select(CHAT_SELECT_BASE)
          .neq("sender_id", user.id)
          .gte("created_at", sinceIso)
          .order("created_at", { ascending: false })
          .limit(80);

        if (baseRes.error) {
          if (isSchemaMissingError(baseRes.error)) {
            return noStoreJson(
              {
                ok: false,
                migrationMissing: true,
                error:
                  "Chat database tables are not set up yet. Apply supabase/migrations/202611120001_enterprise_chat.sql in your Supabase SQL Editor.",
              },
              503
            );
          }
          return noStoreJson({ error: baseRes.error.message }, 500);
        }
        rows = (baseRes.data ?? []) as RawChatRow[];
      } else if (extRes.error) {
        return noStoreJson({ error: extRes.error.message }, 500);
      } else {
        rows = (extRes.data ?? []) as RawChatRow[];
      }

      const activeOrgIds = await getUserActiveOrgIds(supabase, user.id);
      const fallbackOrgId = activeOrgIds[0] ?? null;

      // Compute unread counts per thread against chat_read_receipts
      const unreadByThread: Record<string, number> = {};
      let totalUnread = 0;

      const receiptRes = await supabase
        .from("chat_read_receipts")
        .select("thread_key, last_read_at")
        .eq("user_id", user.id);

      const receiptMap = new Map<string, number>();
      if (receiptRes.error) {
        if (isSchemaMissingError(receiptRes.error)) {
          enhancedMigrationMissing = true;
        }
      } else {
        for (const r of receiptRes.data ?? []) {
          receiptMap.set(String(r.thread_key), new Date(String(r.last_read_at)).getTime());
        }
      }

      if (!receiptRes.error) {
        for (const row of rows) {
          const threadKey = resolveThreadKeyFromRow(row, fallbackOrgId);
          const msgMs = new Date(row.created_at).getTime();
          const lastReadMs = receiptMap.get(threadKey) ?? 0;
          if (msgMs > lastReadMs) {
            unreadByThread[threadKey] = (unreadByThread[threadKey] ?? 0) + 1;
            totalUnread += 1;
          }
        }
      }

      const topRows = rows.slice(0, 25);
      const profilesMap = await fetchProfilesMap(
        supabase,
        topRows.map((r) => r.sender_id)
      );
      const messages = topRows.map((row) =>
        formatHydratedMessage(row, profilesMap, new Map())
      );

      return noStoreJson({
        messages,
        unreadByThread,
        totalUnread,
        enhancedMigrationMissing,
        serverTime: new Date().toISOString(),
      });
    }

    // Fetch chronological window (newest N messages, then reverse) for channel / direct / group
    const runThreadQuery = async (selectCols: string, useExtendedFilter: boolean) => {
      let query = supabase
        .from("workspace_chat_messages")
        .select(selectCols)
        .order("created_at", { ascending: false })
        .limit(MAX_MESSAGE_FETCH);

      if (type === "group") {
        if (!uuidPattern.test(target)) {
          return { data: null, error: { code: "22P02", message: "Invalid group thread ID." } };
        }
        query = query.eq("thread_id", target);
      } else if (type === "direct") {
        if (!uuidPattern.test(target)) {
          return { data: null, error: { code: "22P02", message: "Invalid recipient ID." } };
        }
        query = query.or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${target}),and(sender_id.eq.${target},recipient_id.eq.${user.id})`
        );
      } else {
        query = query.eq("channel", target).is("recipient_id", null);
        if (useExtendedFilter) {
          query = query.is("thread_id", null);
          if (orgParam && uuidPattern.test(orgParam)) {
            query = query.or(`organization_id.eq.${orgParam},organization_id.is.null`);
          }
        }
      }

      return query;
    };

    const extRes = await runThreadQuery(CHAT_SELECT_EXTENDED, true);

    if (extRes.error && isSchemaMissingError(extRes.error)) {
      if (type === "group") {
        return noStoreJson(
          {
            ok: false,
            migrationMissing: true,
            error:
              "Group chat requires the latest database migration. Run supabase/migrations/202611120001_enterprise_chat.sql.",
          },
          503
        );
      }
      enhancedMigrationMissing = true;
      const baseRes = await runThreadQuery(CHAT_SELECT_BASE, false);
      if (baseRes.error) {
        if (isSchemaMissingError(baseRes.error)) {
          return noStoreJson(
            {
              ok: false,
              migrationMissing: true,
              error:
                "Chat database tables are not set up yet. Apply supabase/migrations/202611120001_enterprise_chat.sql in your Supabase SQL Editor.",
            },
            503
          );
        }
        return noStoreJson({ error: baseRes.error.message }, 500);
      }
      rows = ((baseRes.data ?? []) as unknown as RawChatRow[]).reverse();
    } else if (extRes.error) {
      return noStoreJson({ error: extRes.error.message }, 500);
    } else {
      rows = ((extRes.data ?? []) as unknown as RawChatRow[]).reverse();
    }

    const participantIds = new Set<string>();
    for (const r of rows) {
      participantIds.add(r.sender_id);
      if (r.recipient_id) participantIds.add(r.recipient_id);
    }
    if (type === "direct" && uuidPattern.test(target)) {
      participantIds.add(target);
    }

    const [profilesMap, reactionsResult] = await Promise.all([
      fetchProfilesMap(supabase, [...participantIds]),
      hydrateReactionsMap(
        supabase,
        rows.map((r) => r.id),
        user.id
      ),
    ]);

    if (reactionsResult.schemaMissing) {
      enhancedMigrationMissing = true;
    }

    // Fetch peer read receipt(s) for "Seen" indicator
    let peerLastReadAt: string | null = null;
    if (!enhancedMigrationMissing && type === "direct" && uuidPattern.test(target)) {
      const dmKey = buildDirectThreadKey(user.id, target);
      const { data: receipt } = await supabase
        .from("chat_read_receipts")
        .select("last_read_at")
        .eq("user_id", target)
        .eq("thread_key", dmKey)
        .maybeSingle();
      peerLastReadAt = receipt?.last_read_at ? String(receipt.last_read_at) : null;
    } else if (!enhancedMigrationMissing && type === "group" && uuidPattern.test(target)) {
      const grpKey = buildGroupThreadKey(target);
      const { data: receipts } = await supabase
        .from("chat_read_receipts")
        .select("last_read_at")
        .eq("thread_key", grpKey)
        .neq("user_id", user.id)
        .order("last_read_at", { ascending: false })
        .limit(1);
      peerLastReadAt = receipts?.[0]?.last_read_at ? String(receipts[0].last_read_at) : null;
    }

    const messages = rows.map((row) =>
      formatHydratedMessage(row, profilesMap, reactionsResult.map)
    );

    const peerProfile = type === "direct" ? profilesMap.get(target) ?? null : null;

    return noStoreJson({
      messages,
      peerLastReadAt,
      peerPresence: peerProfile?.presence ?? null,
      peerLastSeenAt: peerProfile?.lastSeenAt ?? null,
      enhancedMigrationMissing,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Chat GET error:", err);
    return noStoreJson({ error: "Failed to load messages." }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return noStoreJson({ error: "Unauthorized" }, 401);
    }

    const body = await request.json();
    const parsed = postBodySchema.safeParse(body);
    if (!parsed.success) {
      return noStoreJson(
        { error: parsed.error.issues[0]?.message || "Invalid chat payload." },
        400
      );
    }

    const { type, target, message, replyToId, metadata, workspaceId } = parsed.data;

    if (type === "direct" && target === user.id) {
      return noStoreJson({ error: "Cannot send a direct message to yourself." }, 400);
    }
    if ((type === "direct" || type === "group") && !uuidPattern.test(target)) {
      return noStoreJson({ error: "Invalid conversation target." }, 400);
    }

    const activeOrgIds = await getUserActiveOrgIds(supabase, user.id);
    let resolvedOrgId: string | null = parsed.data.organizationId ?? null;
    if (resolvedOrgId && !activeOrgIds.includes(resolvedOrgId)) {
      return noStoreJson({ error: "Forbidden organization scope." }, 403);
    }
    if (!resolvedOrgId && type === "channel") {
      resolvedOrgId = activeOrgIds[0] ?? null;
    }

    const enrichedMetadata: ChatMessageMetadata = {
      ...(metadata?.linkedEntities?.length
        ? { linkedEntities: metadata.linkedEntities }
        : {}),
      ...(metadata?.attachments?.length
        ? { attachments: metadata.attachments }
        : {}),
    };

    if (replyToId) {
      const { data: parentMsg } = await supabase
        .from("workspace_chat_messages")
        .select("id, sender_id, message")
        .eq("id", replyToId)
        .maybeSingle();

      if (parentMsg) {
        const parentProfiles = await fetchProfilesMap(supabase, [parentMsg.sender_id]);
        const excerpt = stripMarkdownForPreview(parentMsg.message).slice(0, 110);
        enrichedMetadata.replyPreview = {
          id: parentMsg.id,
          senderName: parentProfiles.get(parentMsg.sender_id)?.name ?? "Teammate",
          excerpt: excerpt || "Attachment",
        };
      }
    }

    const extendedPayload = {
      sender_id: user.id,
      recipient_id: type === "direct" ? target : null,
      thread_id: type === "group" ? target : null,
      organization_id: resolvedOrgId,
      workspace_id: workspaceId ?? null,
      channel:
        type === "direct" ? "direct" : type === "group" ? "group" : target,
      message,
      reply_to_id: replyToId ?? null,
      metadata: enrichedMetadata,
    };

    let insertedRow: RawChatRow | null = null;
    let enhancedMigrationMissing = false;

    const extInsert = await supabase
      .from("workspace_chat_messages")
      .insert(extendedPayload)
      .select(CHAT_SELECT_EXTENDED)
      .single();

    if (extInsert.error && isSchemaMissingError(extInsert.error)) {
      if (type === "group") {
        return noStoreJson(
          {
            ok: false,
            migrationMissing: true,
            error:
              "Group chat requires running supabase/migrations/202611120001_enterprise_chat.sql first.",
          },
          503
        );
      }

      enhancedMigrationMissing = true;
      const baseInsert = await supabase
        .from("workspace_chat_messages")
        .insert({
          sender_id: user.id,
          recipient_id: type === "direct" ? target : null,
          workspace_id: workspaceId ?? null,
          channel: type === "direct" ? "direct" : target,
          message,
        })
        .select(CHAT_SELECT_BASE)
        .single();

      if (baseInsert.error) {
        if (isSchemaMissingError(baseInsert.error)) {
          return noStoreJson(
            {
              ok: false,
              migrationMissing: true,
              error:
                "Message could not be saved because the chat table does not exist yet. Run supabase/migrations/202611120001_enterprise_chat.sql in Supabase SQL Editor.",
            },
            503
          );
        }
        return noStoreJson({ error: baseInsert.error.message }, 500);
      }
      insertedRow = baseInsert.data as unknown as RawChatRow;
    } else if (extInsert.error) {
      return noStoreJson({ error: extInsert.error.message }, 500);
    } else {
      insertedRow = extInsert.data as unknown as RawChatRow;
    }

    // Update sender's own read receipt & last_seen_at in background (non-blocking)
    const threadKey =
      type === "group"
        ? buildGroupThreadKey(target)
        : type === "direct"
          ? buildDirectThreadKey(user.id, target)
          : buildChannelThreadKey(target, resolvedOrgId);

    const nowIso = new Date().toISOString();
    await Promise.allSettled([
      touchUserPresence(supabase, user.id),
      supabase
        .from("chat_read_receipts")
        .upsert(
          { user_id: user.id, thread_key: threadKey, last_read_at: nowIso },
          { onConflict: "user_id,thread_key" }
        ),
    ]);

    const profilesMap = await fetchProfilesMap(supabase, [user.id]);
    const formatted = formatHydratedMessage(insertedRow, profilesMap, new Map());

    return noStoreJson(
      {
        ok: true,
        message: formatted,
        enhancedMigrationMissing,
      },
      201
    );
  } catch (err) {
    console.error("Chat POST error:", err);
    return noStoreJson({ error: "Failed to save chat message." }, 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return noStoreJson({ error: "Unauthorized" }, 401);
    }

    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get("id")?.trim() || "";
    if (!uuidPattern.test(messageId)) {
      return noStoreJson({ error: "Invalid message ID." }, 400);
    }

    const { error } = await supabase
      .from("workspace_chat_messages")
      .delete()
      .eq("id", messageId)
      .eq("sender_id", user.id);

    if (error) {
      if (isSchemaMissingError(error)) {
        return noStoreJson({ error: "Chat schema not migrated yet.", migrationMissing: true }, 503);
      }
      return noStoreJson({ error: error.message }, 500);
    }

    return noStoreJson({ ok: true });
  } catch (err) {
    console.error("Chat DELETE error:", err);
    return noStoreJson({ error: "Failed to delete message." }, 500);
  }
}
