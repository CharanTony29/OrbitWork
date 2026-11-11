import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { notifyChannelMentionedUsers } from "@/lib/email";

const postSchema = z.object({
  body: z.string().max(20000).optional().default(""),
  attachmentIds: z.array(z.string().uuid()).max(20).optional().default([]),
  referencedDocumentIds: z
    .array(z.string().uuid())
    .max(20)
    .optional()
    .default([]),
  explicitMentionIds: z.array(z.string().uuid()).max(40).optional().default([]),
});

async function loadChannelRoster(
  projectId: string,
  extraUserIds: string[] = []
) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const reader = admin ?? supabase;

  const { data: project } = await reader
    .from("projects")
    .select("id, name, workspace_id, workspaces(organization_id)")
    .eq("id", projectId)
    .maybeSingle();

  const workspace = Array.isArray(project?.workspaces)
    ? project.workspaces[0]
    : project?.workspaces;
  const orgId = workspace?.organization_id as string | undefined;

  const memberIds = new Set<string>(extraUserIds);

  if (orgId) {
    const { data: orgMembers } = await reader
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("status", "active");
    for (const m of orgMembers ?? []) {
      if (m.user_id) memberIds.add(m.user_id);
    }
  }

  const { data: projectMembers } = await reader
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);
  for (const pm of projectMembers ?? []) {
    if (pm.user_id) memberIds.add(pm.user_id);
  }

  const ids = [...memberIds];
  const { data: profiles } = ids.length
    ? await reader
        .from("profiles")
        .select("id, display_name, email, avatar_url")
        .in("id", ids)
    : { data: [] };

  const profileMap = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      {
        id: p.id,
        label: p.display_name?.trim() || p.email || "Team member",
        email: p.email ?? "",
        avatarUrl: p.avatar_url ?? null,
      },
    ])
  );

  for (const id of ids) {
    if (!profileMap.has(id)) {
      profileMap.set(id, {
        id,
        label: "Team member",
        email: "",
        avatarUrl: null,
      });
    }
  }

  return { profileMap, projectName: project?.name ?? "Project" };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: canAccess } = await supabase.rpc("can_access_project", {
    target_project: projectId,
  });
  if (canAccess !== true) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: canManage } = await supabase.rpc("can_manage_project", {
    target_project: projectId,
  });

  const { data: postsRaw, error: postErr } = await supabase
    .from("project_channel_posts")
    .select(
      "id, project_id, author_id, body, mentioned_user_ids, referenced_document_ids, created_at"
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(60);

  if (postErr) {
    return NextResponse.json({
      migrationMissing: true,
      error: postErr.message,
      posts: [],
      members: [],
      documents: [],
      canManage: canManage === true,
    });
  }

  const posts = [...(postsRaw ?? [])].reverse();
  const postIds = posts.map((p) => p.id);

  const [filesRes, docsRes, rosterResult] = await Promise.all([
    postIds.length
      ? supabase
          .from("project_channel_files")
          .select("id, post_id, file_name, mime_type, file_size_bytes, created_at")
          .eq("project_id", projectId)
          .in("post_id", postIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
    supabase
      .from("project_documents")
      .select("id, title, body_markdown, updated_at")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false })
      .limit(100),
    loadChannelRoster(
      projectId,
      posts.map((p) => p.author_id)
    ),
  ]);

  const filesByPost = new Map<
    string,
    Array<{
      id: string;
      file_name: string;
      mime_type: string;
      file_size_bytes: number;
      url: string;
    }>
  >();

  for (const f of filesRes.data ?? []) {
    if (!f.post_id) continue;
    const list = filesByPost.get(f.post_id) ?? [];
    list.push({
      id: f.id,
      file_name: f.file_name,
      mime_type: f.mime_type,
      file_size_bytes: Number(f.file_size_bytes ?? 0),
      url: `/api/projects/${projectId}/channel/files/${f.id}`,
    });
    filesByPost.set(f.post_id, list);
  }

  const docs = (docsRes.data ?? []).map((doc) => {
    const lower = doc.title.toLowerCase();
    const isFlowchart =
      lower.endsWith(".flowchart") ||
      (doc.body_markdown ?? "").includes('"nodes"');
    const isWhiteboard = lower.endsWith(".whiteboard");
    const cleanTitle = doc.title
      .replace(/\.flowchart$/i, "")
      .replace(/\.whiteboard$/i, "");
    const kind = isFlowchart
      ? "flowchart"
      : isWhiteboard
        ? "whiteboard"
        : "document";
    return {
      id: doc.id,
      title: cleanTitle || doc.title,
      rawTitle: doc.title,
      kind,
      href:
        kind === "flowchart"
          ? `/projects/${projectId}?view=flowchart`
          : kind === "whiteboard"
            ? `/projects/${projectId}?view=whiteboard`
            : `/projects/${projectId}/documents/${doc.id}`,
    };
  });

  type ChannelDocItem = (typeof docs)[number];
  const docMap = new Map<string, ChannelDocItem>(docs.map((d) => [d.id, d]));

  const hydratedPosts = posts.map((post) => {
    const author = rosterResult.profileMap.get(post.author_id);
    const attachedFiles = filesByPost.get(post.id) ?? [];
    const docIds: string[] = Array.isArray(post.referenced_document_ids)
      ? post.referenced_document_ids.filter((id): id is string => typeof id === "string")
      : [];
    const sharedDocs = docIds
      .map((docId) => docMap.get(docId))
      .filter((d): d is ChannelDocItem => Boolean(d));

    return {
      id: post.id,
      authorId: post.author_id,
      authorName: author?.label ?? "Team member",
      authorAvatarUrl: author?.avatarUrl ?? null,
      isMine: post.author_id === user.id,
      body: post.body,
      mentionedUserIds: post.mentioned_user_ids ?? [],
      files: attachedFiles,
      sharedDocs,
      createdAt: post.created_at,
    };
  });

  return NextResponse.json({
    projectName: rosterResult.projectName,
    canManage: canManage === true,
    members: [...rosterResult.profileMap.values()].sort((a, b) =>
      a.label.localeCompare(b.label)
    ),
    documents: docs,
    posts: hydratedPosts,
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: canAccess } = await supabase.rpc("can_access_project", {
    target_project: projectId,
  });
  if (canAccess !== true) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rawBody = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid post payload" }, { status: 400 });
  }

  const trimmedBody = parsed.data.body.trim();
  const attachmentIds = parsed.data.attachmentIds;
  const referencedDocumentIds = parsed.data.referencedDocumentIds;

  if (
    !trimmedBody &&
    attachmentIds.length === 0 &&
    referencedDocumentIds.length === 0
  ) {
    return NextResponse.json(
      { error: "Write a message, attach a file, or share a document/flowchart." },
      { status: 400 }
    );
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("project_channel_posts")
    .insert({
      project_id: projectId,
      author_id: user.id,
      body: trimmedBody,
      mentioned_user_ids: parsed.data.explicitMentionIds,
      referenced_document_ids: referencedDocumentIds,
    })
    .select("id, created_at")
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Could not post to channel" },
      { status: 500 }
    );
  }

  if (attachmentIds.length > 0) {
    await supabase
      .from("project_channel_files")
      .update({ post_id: inserted.id })
      .in("id", attachmentIds)
      .eq("project_id", projectId)
      .eq("uploaded_by", user.id);
  }

  const resolvedMentionIds = await notifyChannelMentionedUsers({
    projectId,
    postBody:
      trimmedBody ||
      (referencedDocumentIds.length > 0
        ? "Shared a project document/flowchart in the channel"
        : "Shared an attachment in the channel"),
    explicitMentionIds: parsed.data.explicitMentionIds,
    authorId: user.id,
  });

  if (resolvedMentionIds.length > 0) {
    await supabase
      .from("project_channel_posts")
      .update({ mentioned_user_ids: resolvedMentionIds })
      .eq("id", inserted.id);
  }

  return NextResponse.json({
    ok: true,
    postId: inserted.id,
    alertedCount: resolvedMentionIds.length,
  });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const postId = req.nextUrl.searchParams.get("postId");
  if (!postId) {
    return NextResponse.json({ error: "Missing postId" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("project_channel_posts")
    .delete()
    .eq("id", postId)
    .eq("project_id", projectId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
