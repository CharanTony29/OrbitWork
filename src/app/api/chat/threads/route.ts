import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  CHAT_CHANNELS,
  buildChannelThreadKey,
  buildDirectThreadKey,
  buildGroupThreadKey,
  formatSidebarTimestamp,
  isSchemaMissingError,
  stripMarkdownForPreview,
  type ChatConversationType,
  type ChatPresenceState,
} from "@/lib/chat";
import {
  CHAT_SELECT_BASE,
  CHAT_SELECT_EXTENDED,
  fetchProfilesMap,
  getUserActiveOrgIds,
  noStoreJson,
  touchUserPresence,
  type RawChatRow,
} from "@/lib/chat-server";

export const dynamic = "force-dynamic";

export type ThreadMemberSummary = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  presence: ChatPresenceState;
  lastSeenAt: string | null;
};

export type UnifiedThreadSummary = {
  threadKey: string;
  type: ChatConversationType;
  target: string;
  title: string;
  subtitle: string;
  lastSnippet: string;
  lastSenderName: string | null;
  lastMessageAt: string | null;
  formattedTime: string;
  unreadCount: number;
  presence?: ChatPresenceState;
  avatarUrl?: string | null;
  members?: ThreadMemberSummary[];
};

const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(280).optional(),
  memberIds: z.array(z.string().uuid()).min(1).max(50),
  organizationId: z.string().uuid().optional().nullable(),
});

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
    const orgParam = searchParams.get("organizationId")?.trim() || null;

    const activeOrgIds = await getUserActiveOrgIds(supabase, user.id);
    const resolvedOrgId =
      orgParam && activeOrgIds.includes(orgParam)
        ? orgParam
        : activeOrgIds[0] ?? null;

    let enhancedMigrationMissing = false;
    let baseMigrationMissing = false;

    // 1. Load active colleagues across accessible organizations
    let colleagueIds: string[] = [];
    if (activeOrgIds.length > 0) {
      const targetOrgs = resolvedOrgId ? [resolvedOrgId] : activeOrgIds;
      const { data: orgMembers } = await supabase
        .from("organization_members")
        .select("user_id")
        .in("organization_id", targetOrgs)
        .eq("status", "active");
      colleagueIds = (orgMembers ?? [])
        .map((m) => String(m.user_id))
        .filter((id) => id !== user.id);
    }

    // 2. Load custom group chats
    let groupRows: Array<{
      id: string;
      name: string;
      description: string;
      organization_id: string | null;
      created_at: string;
      updated_at: string;
    }> = [];
    const groupMembersMap = new Map<string, string[]>();

    const groupRes = await supabase
      .from("chat_threads")
      .select("id, name, description, organization_id, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(80);

    if (groupRes.error) {
      if (isSchemaMissingError(groupRes.error)) {
        enhancedMigrationMissing = true;
      }
    } else {
      groupRows = groupRes.data ?? [];
      if (groupRows.length > 0) {
        const { data: memberRows } = await supabase
          .from("chat_thread_members")
          .select("thread_id, user_id")
          .in(
            "thread_id",
            groupRows.map((g) => g.id)
          );
        for (const mr of memberRows ?? []) {
          const tid = String(mr.thread_id);
          const uid = String(mr.user_id);
          const list = groupMembersMap.get(tid) ?? [];
          list.push(uid);
          groupMembersMap.set(tid, list);
          if (uid !== user.id) colleagueIds.push(uid);
        }
      }
    }

    // 3. Load recent messages across accessible conversations for snippets & ordering
    let recentRows: RawChatRow[] = [];
    const extMsgRes = await supabase
      .from("workspace_chat_messages")
      .select(CHAT_SELECT_EXTENDED)
      .order("created_at", { ascending: false })
      .limit(200);

    if (extMsgRes.error && isSchemaMissingError(extMsgRes.error)) {
      enhancedMigrationMissing = true;
      const baseMsgRes = await supabase
        .from("workspace_chat_messages")
        .select(CHAT_SELECT_BASE)
        .order("created_at", { ascending: false })
        .limit(200);
      if (baseMsgRes.error) {
        if (isSchemaMissingError(baseMsgRes.error)) {
          baseMigrationMissing = true;
        }
      } else {
        recentRows = (baseMsgRes.data ?? []) as RawChatRow[];
      }
    } else if (!extMsgRes.error) {
      recentRows = (extMsgRes.data ?? []) as RawChatRow[];
    }

    for (const row of recentRows) {
      if (row.sender_id !== user.id) colleagueIds.push(row.sender_id);
      if (row.recipient_id && row.recipient_id !== user.id) {
        colleagueIds.push(row.recipient_id);
      }
    }

    // 4. Read receipts
    const receiptMap = new Map<string, number>();
    if (!baseMigrationMissing) {
      const receiptRes = await supabase
        .from("chat_read_receipts")
        .select("thread_key, last_read_at")
        .eq("user_id", user.id);
      if (receiptRes.error) {
        if (isSchemaMissingError(receiptRes.error)) {
          enhancedMigrationMissing = true;
        }
      } else {
        for (const r of receiptRes.data ?? []) {
          receiptMap.set(
            String(r.thread_key),
            new Date(String(r.last_read_at)).getTime()
          );
        }
      }
    }

    const profilesMap = await fetchProfilesMap(supabase, colleagueIds);

    // Aggregate latest message & unread count per threadKey
    const latestByThread = new Map<string, RawChatRow>();
    const unreadCounts = new Map<string, number>();

    for (const row of recentRows) {
      let threadKey: string;
      if (row.thread_id) {
        threadKey = buildGroupThreadKey(row.thread_id);
      } else if (row.recipient_id) {
        const peer = row.sender_id === user.id ? row.recipient_id : row.sender_id;
        threadKey = buildDirectThreadKey(user.id, peer);
      } else {
        // Scope channel messages to the selected org or legacy global rows
        if (
          resolvedOrgId &&
          row.organization_id &&
          row.organization_id !== resolvedOrgId
        ) {
          continue;
        }
        threadKey = buildChannelThreadKey(
          row.channel || "general",
          resolvedOrgId ?? row.organization_id
        );
      }

      if (!latestByThread.has(threadKey)) {
        latestByThread.set(threadKey, row);
      }

      if (row.sender_id !== user.id && !enhancedMigrationMissing && !baseMigrationMissing) {
        const msgMs = new Date(row.created_at).getTime();
        const lastReadMs = receiptMap.get(threadKey) ?? 0;
        if (msgMs > lastReadMs) {
          unreadCounts.set(threadKey, (unreadCounts.get(threadKey) ?? 0) + 1);
        }
      }
    }

    const conversations: UnifiedThreadSummary[] = [];

    // Build default workspace channels
    for (const ch of CHAT_CHANNELS) {
      const threadKey = buildChannelThreadKey(ch.id, resolvedOrgId);
      const latest = latestByThread.get(threadKey);
      const senderName = latest
        ? latest.sender_id === user.id
          ? "You"
          : profilesMap.get(latest.sender_id)?.name ?? "Teammate"
        : null;
      const snippet = latest
        ? stripMarkdownForPreview(latest.message) || "Attachment"
        : ch.desc;

      conversations.push({
        threadKey,
        type: "channel",
        target: ch.id,
        title: `#${ch.name}`,
        subtitle: ch.desc,
        lastSnippet: senderName && latest ? `${senderName}: ${snippet}` : snippet,
        lastSenderName: senderName,
        lastMessageAt: latest?.created_at ?? null,
        formattedTime: formatSidebarTimestamp(latest?.created_at),
        unreadCount: unreadCounts.get(threadKey) ?? 0,
      });
    }

    // Build custom group chats
    for (const grp of groupRows) {
      if (resolvedOrgId && grp.organization_id && grp.organization_id !== resolvedOrgId) {
        continue;
      }
      const threadKey = buildGroupThreadKey(grp.id);
      const latest = latestByThread.get(threadKey);
      const senderName = latest
        ? latest.sender_id === user.id
          ? "You"
          : profilesMap.get(latest.sender_id)?.name ?? "Teammate"
        : null;
      const memberIds = groupMembersMap.get(grp.id) ?? [];
      const memberSummaries: ThreadMemberSummary[] = memberIds
        .filter((id) => id !== user.id)
        .map((id) => {
          const prof = profilesMap.get(id);
          return {
            id,
            name: prof?.name ?? "Teammate",
            email: prof?.email ?? "",
            avatarUrl: prof?.avatarUrl ?? null,
            presence: prof?.presence ?? "offline",
            lastSeenAt: prof?.lastSeenAt ?? null,
          };
        });

      const snippet = latest
        ? stripMarkdownForPreview(latest.message) || "Attachment"
        : grp.description || `${memberIds.length} members`;

      conversations.push({
        threadKey,
        type: "group",
        target: grp.id,
        title: grp.name,
        subtitle: grp.description || `${memberIds.length} participants`,
        lastSnippet: senderName && latest ? `${senderName}: ${snippet}` : snippet,
        lastSenderName: senderName,
        lastMessageAt: latest?.created_at ?? grp.updated_at ?? grp.created_at,
        formattedTime: formatSidebarTimestamp(latest?.created_at ?? grp.updated_at),
        unreadCount: unreadCounts.get(threadKey) ?? 0,
        members: memberSummaries,
      });
    }

    // Build Direct Messages
    const uniquePeerIds = [...new Set(colleagueIds)].filter((id) => id !== user.id);
    for (const peerId of uniquePeerIds) {
      const profile = profilesMap.get(peerId);
      if (!profile) continue;
      const threadKey = buildDirectThreadKey(user.id, peerId);
      const latest = latestByThread.get(threadKey);
      const senderName = latest
        ? latest.sender_id === user.id
          ? "You"
          : profile.name
        : null;
      const snippet = latest
        ? stripMarkdownForPreview(latest.message) || "Attachment"
        : profile.email || "Direct message";

      conversations.push({
        threadKey,
        type: "direct",
        target: peerId,
        title: profile.name,
        subtitle: profile.email,
        lastSnippet: latest && senderName === "You" ? `You: ${snippet}` : snippet,
        lastSenderName: senderName,
        lastMessageAt: latest?.created_at ?? null,
        formattedTime: formatSidebarTimestamp(latest?.created_at),
        unreadCount: unreadCounts.get(threadKey) ?? 0,
        presence: profile.presence,
        avatarUrl: profile.avatarUrl,
      });
    }

    // Sort by unread + most recent activity while keeping unused channels/people tidy
    conversations.sort((a, b) => {
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      const typeOrder: Record<ChatConversationType, number> = {
        group: 0,
        direct: 1,
        channel: 2,
      };
      if (a.type !== b.type) return typeOrder[a.type] - typeOrder[b.type];
      return a.title.localeCompare(b.title);
    });

    const totalUnread = conversations.reduce((sum, item) => sum + item.unreadCount, 0);

    return noStoreJson({
      conversations,
      totalUnread,
      organizationId: resolvedOrgId,
      migrationMissing: baseMigrationMissing,
      enhancedMigrationMissing,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Chat threads GET error:", err);
    return noStoreJson({ error: "Failed to load chat threads." }, 500);
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
    const parsed = createGroupSchema.safeParse(body);
    if (!parsed.success) {
      return noStoreJson(
        { error: parsed.error.issues[0]?.message || "Invalid group chat input." },
        400
      );
    }

    const activeOrgIds = await getUserActiveOrgIds(supabase, user.id);
    const resolvedOrgId =
      parsed.data.organizationId && activeOrgIds.includes(parsed.data.organizationId)
        ? parsed.data.organizationId
        : activeOrgIds[0] ?? null;

    const { data: createdThread, error: createErr } = await supabase
      .from("chat_threads")
      .insert({
        name: parsed.data.name,
        description: parsed.data.description ?? "",
        organization_id: resolvedOrgId,
        created_by: user.id,
      })
      .select("id, name, description, organization_id, created_at, updated_at")
      .single();

    if (createErr) {
      if (isSchemaMissingError(createErr)) {
        return noStoreJson(
          {
            ok: false,
            migrationMissing: true,
            error:
              "Group chat tables are not created yet. Run supabase/migrations/202611120001_enterprise_chat.sql first.",
          },
          503
        );
      }
      return noStoreJson({ error: createErr.message }, 500);
    }

    const uniqueMembers = [...new Set([user.id, ...parsed.data.memberIds])];
    const { error: memberErr } = await supabase
      .from("chat_thread_members")
      .insert(
        uniqueMembers.map((uid) => ({
          thread_id: createdThread.id,
          user_id: uid,
          role: uid === user.id ? "owner" : "member",
        }))
      );

    if (memberErr) {
      return noStoreJson({ error: memberErr.message }, 500);
    }

    // Touch creator presence
    await touchUserPresence(supabase, user.id);

    return noStoreJson({
      ok: true,
      thread: {
        id: createdThread.id,
        threadKey: buildGroupThreadKey(createdThread.id),
        name: createdThread.name,
        description: createdThread.description,
        memberCount: uniqueMembers.length,
      },
    }, 201);
  } catch (err) {
    console.error("Chat threads POST error:", err);
    return noStoreJson({ error: "Failed to create group chat." }, 500);
  }
}
