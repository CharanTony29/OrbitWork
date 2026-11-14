// src/lib/docs/service.ts
import { createClient, createAdminClient } from "../supabase/server.ts";
import type {
  DocItem,
  DocPageItem,
  PageListingNode,
  DocBlock,
  DocComment,
  DocMember,
  DocActivity,
  DocVersion,
} from "./types.ts";
import { DOC_TEMPLATES } from "./templates.ts";
import { markdownToSafeHtml } from "../markdown.ts";

import { blocksToMarkdown, markdownToBlocks } from "./blocks.ts";
export { blocksToMarkdown, markdownToBlocks };

// ---------------------------------------------------------------------------
// DOCUMENT OPERATIONS
// ---------------------------------------------------------------------------

export async function getWorkspaceDocs(
  workspaceId: string,
  options?: {
    projectId?: string;
    filter?: string;
    query?: string;
    tag?: string;
    sort?: string;
    isArchived?: boolean;
    isTrash?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<{ docs: DocItem[]; total: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { docs: [], total: 0 };

  let queryBuilder = supabase
    .from("docs")
    .select(
      `
      id,
      workspace_id,
      project_id,
      title,
      icon,
      cover_url,
      description,
      is_wiki,
      is_protected,
      is_private,
      is_archived,
      is_template,
      template_category,
      is_published,
      public_slug,
      published_at,
      tags,
      created_by,
      updated_by,
      deleted_at,
      created_at,
      updated_at,
      projects(id, name),
      workspaces(id, name),
      profiles:created_by(id, display_name, email)
    `,
      { count: "exact" }
    )
    .eq("workspace_id", workspaceId);

  // Trash vs active
  if (options?.isTrash) {
    queryBuilder = queryBuilder.not("deleted_at", "is", null);
  } else {
    queryBuilder = queryBuilder.is("deleted_at", null);
    if (options?.isArchived !== undefined) {
      queryBuilder = queryBuilder.eq("is_archived", options.isArchived);
    } else {
      queryBuilder = queryBuilder.eq("is_archived", false);
    }
  }

  if (options?.projectId) {
    queryBuilder = queryBuilder.eq("project_id", options.projectId);
  }

  if (options?.tag) {
    queryBuilder = queryBuilder.contains("tags", [options.tag]);
  }

  // Filter types
  if (options?.filter === "mine" || options?.filter === "created_by_me") {
    queryBuilder = queryBuilder.eq("created_by", user.id);
  } else if (options?.filter === "wiki" || options?.filter === "wikis") {
    queryBuilder = queryBuilder.eq("is_wiki", true);
  } else if (options?.filter === "templates") {
    queryBuilder = queryBuilder.eq("is_template", true);
  }

  // Text search
  if (options?.query && options.query.trim()) {
    const term = options.query.trim();
    queryBuilder = queryBuilder.ilike("title", `%${term}%`);
  }

  // Sorting
  if (options?.sort === "title") {
    queryBuilder = queryBuilder.order("title", { ascending: true });
  } else if (options?.sort === "created") {
    queryBuilder = queryBuilder.order("created_at", { ascending: false });
  } else {
    queryBuilder = queryBuilder.order("updated_at", { ascending: false });
  }

  if (options?.limit) {
    const offset = options.offset || 0;
    queryBuilder = queryBuilder.range(offset, offset + options.limit - 1);
  }

  const { data, count, error } = await queryBuilder;
  if (error || !data) {
    console.error("getWorkspaceDocs error", error);
    return { docs: [], total: 0 };
  }

  // Check favorites
  const { data: favRows } = await supabase
    .from("user_favorites")
    .select("entity_id")
    .eq("user_id", user.id)
    .eq("entity_type", "document");

  const favSet = new Set((favRows || []).map((f) => f.entity_id));

  // Get page counts per doc
  const docIds = data.map((d) => d.id);
  let pageCountMap: Record<string, number> = {};
  if (docIds.length) {
    const { data: pageRows } = await supabase
      .from("doc_pages")
      .select("doc_id")
      .in("doc_id", docIds)
      .is("deleted_at", null);

    if (pageRows) {
      for (const p of pageRows) {
        pageCountMap[p.doc_id] = (pageCountMap[p.doc_id] || 0) + 1;
      }
    }
  }

  const docs: DocItem[] = data.map((d: any) => ({
    id: d.id,
    workspace_id: d.workspace_id,
    project_id: d.project_id,
    title: d.title,
    icon: d.icon || "📄",
    cover_url: d.cover_url,
    description: d.description || "",
    is_wiki: Boolean(d.is_wiki),
    is_protected: Boolean(d.is_protected),
    is_private: Boolean(d.is_private),
    is_archived: Boolean(d.is_archived),
    is_template: Boolean(d.is_template),
    template_category: d.template_category,
    is_published: Boolean(d.is_published),
    public_slug: d.public_slug,
    published_at: d.published_at,
    tags: d.tags || [],
    created_by: d.created_by,
    updated_by: d.updated_by,
    deleted_at: d.deleted_at,
    created_at: d.created_at,
    updated_at: d.updated_at,
    project_name: d.projects?.name,
    workspace_name: d.workspaces?.name,
    creator_name: d.profiles?.display_name || d.profiles?.email || "Teammate",
    pages_count: pageCountMap[d.id] || 1,
    is_favorited: favSet.has(d.id),
  }));

  // Handle "favorites" or "shared_with_me" filter client-side
  let filteredDocs = docs;
  if (options?.filter === "favorites") {
    filteredDocs = docs.filter((d) => d.is_favorited);
  }

  return { docs: filteredDocs, total: count || filteredDocs.length };
}

export async function getDoc(docId: string): Promise<DocItem | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("docs")
    .select(
      `
      id,
      workspace_id,
      project_id,
      title,
      icon,
      cover_url,
      description,
      is_wiki,
      is_protected,
      is_private,
      is_archived,
      is_template,
      template_category,
      is_published,
      public_slug,
      published_at,
      tags,
      created_by,
      updated_by,
      deleted_at,
      created_at,
      updated_at,
      projects(id, name),
      workspaces(id, name),
      profiles:created_by(id, display_name, email)
    `
    )
    .eq("id", docId)
    .maybeSingle();

  if (error || !data) return null;

  const { data: favRow } = await supabase
    .from("user_favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("entity_type", "document")
    .eq("entity_id", docId)
    .maybeSingle();

  return {
    id: data.id,
    workspace_id: data.workspace_id,
    project_id: data.project_id,
    title: data.title,
    icon: data.icon || "📄",
    cover_url: data.cover_url,
    description: data.description || "",
    is_wiki: Boolean(data.is_wiki),
    is_protected: Boolean(data.is_protected),
    is_private: Boolean(data.is_private),
    is_archived: Boolean(data.is_archived),
    is_template: Boolean(data.is_template),
    template_category: data.template_category,
    is_published: Boolean(data.is_published),
    public_slug: data.public_slug,
    published_at: data.published_at,
    tags: data.tags || [],
    created_by: data.created_by,
    updated_by: data.updated_by,
    deleted_at: data.deleted_at,
    created_at: data.created_at,
    updated_at: data.updated_at,
    project_name: (data.projects as any)?.name,
    workspace_name: (data.workspaces as any)?.name,
    creator_name: (data.profiles as any)?.display_name || (data.profiles as any)?.email || "Teammate",
    is_favorited: Boolean(favRow),
  };
}

export async function createDoc(params: {
  workspaceId: string;
  projectId?: string | null;
  title: string;
  icon?: string;
  description?: string;
  isWiki?: boolean;
  isPrivate?: boolean;
  templateId?: string;
  tags?: string[];
}): Promise<{ ok: boolean; doc?: DocItem; page?: DocPageItem; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const db = createAdminClient() || supabase;

  const template = params.templateId ? DOC_TEMPLATES.find((t) => t.id === params.templateId) : null;
  const title = params.title.trim() || template?.title || "Untitled Document";
  const icon = params.icon || template?.icon || "📄";

  // Insert doc container
  const { data: newDoc, error: docErr } = await db
    .from("docs")
    .insert({
      workspace_id: params.workspaceId,
      project_id: params.projectId || null,
      title,
      icon,
      description: params.description || template?.description || "",
      is_wiki: Boolean(params.isWiki),
      is_private: Boolean(params.isPrivate),
      tags: params.tags || [],
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single();

  if (docErr || !newDoc) {
    console.error("createDoc error", docErr);
    return { ok: false, error: docErr?.message || "Failed to create document" };
  }

  // Also maintain owner membership
  await db.from("doc_members").insert({
    doc_id: newDoc.id,
    user_id: user.id,
    role: "owner",
  });

  // Log activity
  await logDocActivity(newDoc.id, null, "created", { title });

  // Create primary root page
  let primaryBlocks: DocBlock[] = [];
  if (template && template.initialPages.length) {
    primaryBlocks = template.initialPages[0].blocks;
  } else {
    primaryBlocks = [
      { id: "b-head", type: "heading_1", data: { text: title } },
      { id: "b-p", type: "paragraph", data: { text: "" } },
    ];
  }

  const primaryMarkdown = blocksToMarkdown(primaryBlocks);

  const { data: rootPage, error: pageErr } = await db
    .from("doc_pages")
    .insert({
      doc_id: newDoc.id,
      parent_page_id: null,
      title,
      icon,
      position: 1000.0,
      content_json: primaryBlocks,
      content_markdown: primaryMarkdown,
      page_type: params.isWiki ? "wiki" : "standard",
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single();

  if (pageErr) {
    console.error("create root page error", pageErr);
  }

  // If template has subpages, create them recursively
  if (template && template.initialPages[0]?.subpages && rootPage) {
    for (let i = 0; i < template.initialPages[0].subpages.length; i++) {
      const sp = template.initialPages[0].subpages[i];
      await db.from("doc_pages").insert({
        doc_id: newDoc.id,
        parent_page_id: rootPage.id,
        title: sp.title,
        icon: sp.icon,
        position: (i + 1) * 1000.0,
        content_json: sp.blocks,
        content_markdown: blocksToMarkdown(sp.blocks),
        page_type: params.isWiki ? "wiki" : "standard",
        created_by: user.id,
        updated_by: user.id,
      });
    }
  }

  return {
    ok: true,
    doc: newDoc as DocItem,
    page: rootPage as DocPageItem,
  };
}

export async function updateDoc(
  docId: string,
  updates: Partial<{
    title: string;
    icon: string;
    cover_url: string | null;
    description: string;
    is_wiki: boolean;
    is_protected: boolean;
    is_private: boolean;
    is_archived: boolean;
    tags: string[];
    deleted_at: string | null;
  }>
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const { error } = await supabase
    .from("docs")
    .update({
      ...updates,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", docId);

  if (error) {
    return { ok: false, error: error.message };
  }

  // If title changed, also sync root page title
  if (updates.title) {
    await supabase
      .from("doc_pages")
      .update({
        title: updates.title,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("doc_id", docId)
      .is("parent_page_id", null);

    await logDocActivity(docId, null, "renamed", { newTitle: updates.title });
  }

  if (updates.is_archived !== undefined) {
    await logDocActivity(docId, null, updates.is_archived ? "archived" : "restored", {});
  }

  return { ok: true };
}

export async function deleteDoc(
  docId: string,
  permanent: boolean = false
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  if (permanent) {
    const { error } = await supabase.from("docs").delete().eq("id", docId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } else {
    // Soft delete to Trash
    const { error } = await supabase
      .from("docs")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", docId);
    if (error) return { ok: false, error: error.message };
    await logDocActivity(docId, null, "deleted", { soft: true });
    return { ok: true };
  }
}

export async function restoreDoc(docId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const { error } = await supabase
    .from("docs")
    .update({
      deleted_at: null,
      is_archived: false,
      updated_by: user.id,
    })
    .eq("id", docId);

  if (error) return { ok: false, error: error.message };
  await logDocActivity(docId, null, "restored", {});
  return { ok: true };
}

export async function duplicateDoc(
  docId: string
): Promise<{ ok: boolean; newDocId?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const orig = await getDoc(docId);
  if (!orig) return { ok: false, error: "Original document not found" };

  const created = await createDoc({
    workspaceId: orig.workspace_id,
    projectId: orig.project_id,
    title: `${orig.title} (Copy)`,
    icon: orig.icon,
    description: orig.description,
    isWiki: orig.is_wiki,
    isPrivate: orig.is_private,
    tags: orig.tags,
  });

  if (!created.ok || !created.doc) {
    return { ok: false, error: created.error };
  }

  // Copy all non-root pages
  const { data: origPages } = await supabase
    .from("doc_pages")
    .select("*")
    .eq("doc_id", docId)
    .is("deleted_at", null)
    .order("position", { ascending: true });

  if (origPages && origPages.length > 0) {
    const pageIdMap = new Map<string, string>();
    // Root page corresponds to created.page
    const rootOrig = origPages.find((p) => !p.parent_page_id);
    if (rootOrig && created.page) {
      pageIdMap.set(rootOrig.id, created.page.id);
      // Update content of created root page
      await supabase
        .from("doc_pages")
        .update({
          content_json: rootOrig.content_json,
          content_markdown: rootOrig.content_markdown,
        })
        .eq("id", created.page.id);
    }

    // Insert other pages in topological order
    const remaining = origPages.filter((p) => p.parent_page_id);
    for (const p of remaining) {
      const newParentId = p.parent_page_id ? pageIdMap.get(p.parent_page_id) || created.page?.id : null;
      const { data: newP } = await supabase
        .from("doc_pages")
        .insert({
          doc_id: created.doc.id,
          parent_page_id: newParentId,
          title: p.title,
          icon: p.icon,
          position: p.position,
          content_json: p.content_json,
          content_markdown: p.content_markdown,
          page_type: p.page_type,
          created_by: user.id,
          updated_by: user.id,
        })
        .select("id")
        .single();

      if (newP) {
        pageIdMap.set(p.id, newP.id);
      }
    }
  }

  return { ok: true, newDocId: created.doc.id };
}

// ---------------------------------------------------------------------------
// PAGE HIERARCHY & PAGE LISTING
// ---------------------------------------------------------------------------

export async function getPageListing(docId: string): Promise<PageListingNode[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Lightweight metadata query — DO NOT fetch heavy content_json/content_markdown!
  const { data: rows, error } = await supabase
    .from("doc_pages")
    .select("id, doc_id, parent_page_id, title, icon, position, created_at, updated_at, is_archived")
    .eq("doc_id", docId)
    .is("deleted_at", null)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !rows) {
    console.error("getPageListing error", error);
    return [];
  }

  // Build tree
  const nodeMap = new Map<string, PageListingNode>();
  const rootNodes: PageListingNode[] = [];

  for (const r of rows) {
    nodeMap.set(r.id, {
      id: r.id,
      doc_id: r.doc_id,
      parent_page_id: r.parent_page_id,
      title: r.title || "Untitled Page",
      icon: r.icon || "📄",
      position: r.position,
      has_children: false,
      children_count: 0,
      created_at: r.created_at,
      updated_at: r.updated_at,
      is_archived: Boolean(r.is_archived),
      children: [],
    });
  }

  for (const node of nodeMap.values()) {
    if (node.parent_page_id && nodeMap.has(node.parent_page_id)) {
      const parent = nodeMap.get(node.parent_page_id)!;
      parent.children!.push(node);
      parent.has_children = true;
      parent.children_count += 1;
    } else {
      rootNodes.push(node);
    }
  }

  return rootNodes;
}

export async function getPage(docId: string, pageId: string): Promise<DocPageItem | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("doc_pages")
    .select("*")
    .eq("doc_id", docId)
    .eq("id", pageId)
    .maybeSingle();

  if (error || !data) return null;

  // Convert raw json / markdown if needed
  let blocks: DocBlock[] = [];
  if (data.content_json && Array.isArray(data.content_json) && data.content_json.length > 0) {
    blocks = data.content_json;
  } else if (data.content_markdown) {
    blocks = markdownToBlocks(data.content_markdown);
  } else {
    blocks = [{ id: "b1", type: "paragraph", data: { text: "" } }];
  }

  return {
    id: data.id,
    doc_id: data.doc_id,
    parent_page_id: data.parent_page_id,
    title: data.title || "Untitled Page",
    icon: data.icon || "📄",
    cover_url: data.cover_url,
    position: data.position,
    content_json: blocks,
    content_markdown: data.content_markdown || "",
    page_type: data.page_type || "standard",
    is_archived: Boolean(data.is_archived),
    deleted_at: data.deleted_at,
    created_by: data.created_by,
    updated_by: data.updated_by,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function createPage(
  docId: string,
  params: {
    parentPageId?: string | null;
    title?: string;
    icon?: string;
    position?: number;
    contentJson?: DocBlock[];
    contentMarkdown?: string;
    pageType?: "standard" | "wiki" | "landing" | "documentation";
  }
): Promise<{ ok: boolean; page?: DocPageItem; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const db = createAdminClient() || supabase;

  const title = params.title?.trim() || "Untitled Page";
  const icon = params.icon || "📄";

  let pos = params.position;
  if (pos === undefined) {
    // Find max position in parent
    const { data: siblings } = await db
      .from("doc_pages")
      .select("position")
      .eq("doc_id", docId)
      .is("deleted_at", null)
      .order("position", { ascending: false })
      .limit(1);

    pos = siblings && siblings.length > 0 ? siblings[0].position + 1000.0 : 1000.0;
  }

  const blocks = params.contentJson || [{ id: "b1", type: "paragraph", data: { text: "" } }];
  const markdown = params.contentMarkdown || blocksToMarkdown(blocks);

  const { data, error } = await db
    .from("doc_pages")
    .insert({
      doc_id: docId,
      parent_page_id: params.parentPageId || null,
      title,
      icon,
      position: pos,
      content_json: blocks,
      content_markdown: markdown,
      page_type: params.pageType || "standard",
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message || "Failed to create page" };
  }

  await logDocActivity(docId, data.id, "created", { title, pageId: data.id });

  return { ok: true, page: data as DocPageItem };
}

export async function updatePage(
  docId: string,
  pageId: string,
  updates: Partial<{
    title: string;
    icon: string;
    cover_url: string | null;
    position: number;
    parent_page_id: string | null;
    content_json: DocBlock[];
    content_markdown: string;
    page_type: "standard" | "wiki" | "landing" | "documentation";
    is_archived: boolean;
  }>
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const payload: any = {
    ...updates,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };

  if (updates.content_json && !updates.content_markdown) {
    payload.content_markdown = blocksToMarkdown(updates.content_json);
  }

  const { error } = await supabase
    .from("doc_pages")
    .update(payload)
    .eq("doc_id", docId)
    .eq("id", pageId);

  if (error) return { ok: false, error: error.message };

  // Touch parent doc updated_at
  await supabase
    .from("docs")
    .update({ updated_at: new Date().toISOString(), updated_by: user.id })
    .eq("id", docId);

  // If this was a content update, snapshot to versions
  if (updates.content_json || updates.title) {
    await createVersionSnapshot(docId, pageId, {
      title: updates.title || "Page Edit",
      contentJson: updates.content_json,
      contentMarkdown: payload.content_markdown,
      summary: "Autosave revision",
      userId: user.id,
    });
  }

  return { ok: true };
}

export async function movePage(
  docId: string,
  pageId: string,
  params: { parentPageId: string | null; position: number }
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const { error } = await supabase
    .from("doc_pages")
    .update({
      parent_page_id: params.parentPageId,
      position: params.position,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("doc_id", docId)
    .eq("id", pageId);

  if (error) return { ok: false, error: error.message };
  await logDocActivity(docId, pageId, "moved", { parentPageId: params.parentPageId, position: params.position });
  return { ok: true };
}

export async function deletePage(
  docId: string,
  pageId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const { error } = await supabase
    .from("doc_pages")
    .update({
      deleted_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("doc_id", docId)
    .eq("id", pageId);

  if (error) return { ok: false, error: error.message };
  await logDocActivity(docId, pageId, "deleted", {});
  return { ok: true };
}

// ---------------------------------------------------------------------------
// COMMENTS & TASK CONVERSION
// ---------------------------------------------------------------------------

export async function getComments(pageId: string): Promise<DocComment[]> {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("doc_comments")
    .select(
      `
      id,
      doc_id,
      page_id,
      parent_comment_id,
      author_id,
      content,
      selected_text,
      block_id,
      is_resolved,
      resolved_by,
      resolved_at,
      created_at,
      updated_at,
      profiles:author_id(display_name, email)
    `
    )
    .eq("page_id", pageId)
    .order("created_at", { ascending: true });

  if (error || !rows) return [];

  const commentMap = new Map<string, DocComment>();
  const topLevel: DocComment[] = [];

  for (const r of rows) {
    const item: DocComment = {
      id: r.id,
      doc_id: r.doc_id,
      page_id: r.page_id,
      parent_comment_id: r.parent_comment_id,
      author_id: r.author_id,
      author_name: (r.profiles as any)?.display_name || (r.profiles as any)?.email || "Teammate",
      content: r.content,
      selected_text: r.selected_text,
      block_id: r.block_id,
      is_resolved: Boolean(r.is_resolved),
      resolved_by: r.resolved_by,
      resolved_at: r.resolved_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
      replies: [],
    };
    commentMap.set(r.id, item);
  }

  for (const c of commentMap.values()) {
    if (c.parent_comment_id && commentMap.has(c.parent_comment_id)) {
      commentMap.get(c.parent_comment_id)!.replies!.push(c);
    } else {
      topLevel.push(c);
    }
  }

  return topLevel;
}

export async function createComment(
  docId: string,
  pageId: string,
  params: {
    content: string;
    selectedText?: string;
    blockId?: string;
    parentCommentId?: string;
  }
): Promise<{ ok: boolean; comment?: DocComment; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const { data, error } = await supabase
    .from("doc_comments")
    .insert({
      doc_id: docId,
      page_id: pageId,
      parent_comment_id: params.parentCommentId || null,
      author_id: user.id,
      content: params.content.trim(),
      selected_text: params.selectedText || null,
      block_id: params.blockId || null,
    })
    .select(
      `
      id, doc_id, page_id, parent_comment_id, author_id, content, selected_text, block_id,
      is_resolved, created_at, updated_at, profiles:author_id(display_name, email)
    `
    )
    .single();

  if (error || !data) return { ok: false, error: error?.message || "Failed to create comment" };

  await logDocActivity(docId, pageId, "commented", {
    commentId: data.id,
    content: params.content.slice(0, 100),
  });

  return {
    ok: true,
    comment: {
      id: data.id,
      doc_id: data.doc_id,
      page_id: data.page_id,
      parent_comment_id: data.parent_comment_id,
      author_id: data.author_id,
      author_name: (data.profiles as any)?.display_name || (data.profiles as any)?.email || "Teammate",
      content: data.content,
      selected_text: data.selected_text,
      block_id: data.block_id,
      is_resolved: false,
      created_at: data.created_at,
      updated_at: data.updated_at,
      replies: [],
    },
  };
}

export async function resolveComment(
  commentId: string,
  resolved: boolean
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const { data: comment, error } = await supabase
    .from("doc_comments")
    .update({
      is_resolved: resolved,
      resolved_by: resolved ? user.id : null,
      resolved_at: resolved ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", commentId)
    .select("doc_id, page_id")
    .single();

  if (error || !comment) return { ok: false, error: error?.message };

  await logDocActivity(comment.doc_id, comment.page_id, resolved ? "comment_resolved" : "commented", {
    commentId,
    resolved,
  });

  return { ok: true };
}

export async function convertCommentToTask(
  commentId: string,
  params: { projectId: string; title: string; description?: string }
): Promise<{ ok: boolean; taskId?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  // Fetch comment details
  const { data: comment } = await supabase
    .from("doc_comments")
    .select("doc_id, page_id, content, selected_text")
    .eq("id", commentId)
    .maybeSingle();

  if (!comment) return { ok: false, error: "Comment not found" };

  const taskTitle = params.title.trim() || comment.content.slice(0, 80);
  const taskDesc = `${params.description ? params.description + "\n\n" : ""}${comment.selected_text ? `> Quoted text: "${comment.selected_text}"\n\n` : ""}Originated from document comment: "${comment.content}"`;

  // Find a default status in the project
  const { data: statuses } = await supabase
    .from("project_statuses")
    .select("id")
    .eq("project_id", params.projectId)
    .order("position", { ascending: true })
    .limit(1);

  const statusId = statuses?.[0]?.id;

  // Insert task
  const { data: newTask, error: taskErr } = await supabase
    .from("tasks")
    .insert({
      project_id: params.projectId,
      title: taskTitle,
      description: taskDesc,
      status_id: statusId || null,
      priority: "medium",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (taskErr || !newTask) {
    return { ok: false, error: taskErr?.message || "Failed to create task" };
  }

  // Link task to document & page
  await supabase.from("doc_linked_tasks").insert({
    doc_id: comment.doc_id,
    page_id: comment.page_id,
    task_id: newTask.id,
    created_by: user.id,
  });

  // Mark comment as resolved with a note
  await supabase
    .from("doc_comments")
    .update({
      is_resolved: true,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
      content: `${comment.content}\n\n*(Converted to Task #${newTask.id.slice(0, 8)})*`,
    })
    .eq("id", commentId);

  return { ok: true, taskId: newTask.id };
}

// ---------------------------------------------------------------------------
// VERSION HISTORY
// ---------------------------------------------------------------------------

export async function getVersions(pageId: string): Promise<DocVersion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("doc_page_versions")
    .select(
      `
      id, page_id, doc_id, title, content_json, content_markdown,
      version_number, changed_by, change_summary, created_at,
      profiles:changed_by(display_name, email)
    `
    )
    .eq("page_id", pageId)
    .order("version_number", { ascending: false });

  if (error || !data) return [];

  return data.map((v: any) => ({
    id: v.id,
    page_id: v.page_id,
    doc_id: v.doc_id,
    title: v.title,
    content_json: v.content_json || [],
    content_markdown: v.content_markdown || "",
    version_number: v.version_number,
    changed_by: v.changed_by,
    changer_name: v.profiles?.display_name || v.profiles?.email || "Editor",
    change_summary: v.change_summary || "Revision",
    created_at: v.created_at,
  }));
}

export async function createVersionSnapshot(
  docId: string,
  pageId: string,
  params: {
    title: string;
    contentJson?: DocBlock[];
    contentMarkdown?: string;
    summary?: string;
    userId: string;
  }
): Promise<void> {
  const supabase = await createClient();

  // Get current max version number
  const { data: latest } = await supabase
    .from("doc_page_versions")
    .select("version_number, created_at")
    .eq("page_id", pageId)
    .order("version_number", { ascending: false })
    .limit(1);

  // If latest snapshot was created less than 60 seconds ago, update it instead of cluttering
  if (latest && latest.length > 0) {
    const elapsed = Date.now() - Date.parse(latest[0].created_at);
    if (elapsed < 60_000) {
      return;
    }
  }

  const nextVer = latest && latest.length > 0 ? latest[0].version_number + 1 : 1;

  await supabase.from("doc_page_versions").insert({
    page_id: pageId,
    doc_id: docId,
    title: params.title,
    content_json: params.contentJson || [],
    content_markdown: params.contentMarkdown || "",
    version_number: nextVer,
    changed_by: params.userId,
    change_summary: params.summary || `Version ${nextVer}`,
  });
}

export async function restoreVersion(
  docId: string,
  pageId: string,
  versionId: number
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const { data: ver, error: verErr } = await supabase
    .from("doc_page_versions")
    .select("title, content_json, content_markdown")
    .eq("id", versionId)
    .single();

  if (verErr || !ver) return { ok: false, error: "Version not found" };

  // Update current page with this content
  const { error: updateErr } = await supabase
    .from("doc_pages")
    .update({
      title: ver.title,
      content_json: ver.content_json,
      content_markdown: ver.content_markdown,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pageId);

  if (updateErr) return { ok: false, error: updateErr.message };

  await logDocActivity(docId, pageId, "version_restored", {
    versionId,
    title: ver.title,
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// SHARING & PERMISSIONS
// ---------------------------------------------------------------------------

export async function getDocMembers(docId: string): Promise<DocMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("doc_members")
    .select(
      `
      id, doc_id, user_id, role, created_at,
      profiles:user_id(display_name, email)
    `
    )
    .eq("doc_id", docId);

  if (error || !data) return [];

  return data.map((m: any) => ({
    id: m.id,
    doc_id: m.doc_id,
    user_id: m.user_id,
    role: m.role,
    user_name: m.profiles?.display_name || m.profiles?.email || "Member",
    user_email: m.profiles?.email || "",
    created_at: m.created_at,
  }));
}

export async function updateDocMember(
  docId: string,
  targetUserId: string,
  role: "owner" | "editor" | "commenter" | "viewer"
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const { error } = await supabase.from("doc_members").upsert(
    {
      doc_id: docId,
      user_id: targetUserId,
      role,
    },
    { onConflict: "doc_id,user_id" }
  );

  if (error) return { ok: false, error: error.message };
  await logDocActivity(docId, null, "shared", { targetUserId, role });
  return { ok: true };
}

export async function removeDocMember(
  docId: string,
  targetUserId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const { error } = await supabase
    .from("doc_members")
    .delete()
    .eq("doc_id", docId)
    .eq("user_id", targetUserId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// PUBLIC PUBLISHING
// ---------------------------------------------------------------------------

export async function toggleDocPublish(
  docId: string,
  publish: boolean
): Promise<{ ok: boolean; publicSlug?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  let publicSlug: string | null = null;
  if (publish) {
    // Generate clean 16-char URL-safe slug
    publicSlug = `doc-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
  }

  const { error } = await supabase
    .from("docs")
    .update({
      is_published: publish,
      public_slug: publicSlug,
      published_at: publish ? new Date().toISOString() : null,
      updated_by: user.id,
    })
    .eq("id", docId);

  if (error) return { ok: false, error: error.message };
  await logDocActivity(docId, null, publish ? "published" : "unpublished", { publicSlug });
  return { ok: true, publicSlug: publicSlug || undefined };
}

export async function getPublicDoc(slug: string): Promise<{
  doc: { title: string; icon: string; description: string; updated_at: string };
  pages: { id: string; title: string; icon: string; parent_page_id: string | null; position: number }[];
  activePage: { title: string; icon: string; content_markdown: string; html: string };
} | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data: doc } = await admin
    .from("docs")
    .select("id, title, icon, description, updated_at")
    .eq("public_slug", slug)
    .eq("is_published", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (!doc) return null;

  const { data: pages } = await admin
    .from("doc_pages")
    .select("id, title, icon, parent_page_id, position, content_markdown")
    .eq("doc_id", doc.id)
    .is("deleted_at", null)
    .order("position", { ascending: true });

  if (!pages || !pages.length) return null;

  const root = pages[0];
  const safeHtml = markdownToSafeHtml(root.content_markdown || "");

  return {
    doc,
    pages: pages.map((p) => ({
      id: p.id,
      title: p.title,
      icon: p.icon,
      parent_page_id: p.parent_page_id,
      position: p.position,
    })),
    activePage: {
      title: root.title,
      icon: root.icon,
      content_markdown: root.content_markdown,
      html: safeHtml,
    },
  };
}

// ---------------------------------------------------------------------------
// ACTIVITY LOGGING
// ---------------------------------------------------------------------------

export async function logDocActivity(
  docId: string,
  pageId: string | null,
  action: DocActivity["action"],
  details: Record<string, any>
): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("doc_activities").insert({
      doc_id: docId,
      page_id: pageId,
      actor_id: user?.id || null,
      action,
      details,
    });
  } catch (err) {
    console.error("Failed to log doc activity", err);
  }
}

export async function getDocActivities(docId: string): Promise<DocActivity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("doc_activities")
    .select(
      `
      id, doc_id, page_id, actor_id, action, details, created_at,
      profiles:actor_id(display_name, email)
    `
    )
    .eq("doc_id", docId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return data.map((a: any) => ({
    id: a.id,
    doc_id: a.doc_id,
    page_id: a.page_id,
    actor_id: a.actor_id,
    actor_name: a.profiles?.display_name || a.profiles?.email || "Teammate",
    action: a.action,
    details: a.details || {},
    created_at: a.created_at,
  }));
}

// ---------------------------------------------------------------------------
// SERVER-SIDE SEARCH
// ---------------------------------------------------------------------------

export async function searchDocs(
  workspaceId: string,
  term: string
): Promise<{
  docs: { id: string; title: string; icon: string; snippet: string; updated_at: string }[];
  pages: { id: string; doc_id: string; title: string; icon: string; snippet: string; doc_title: string }[];
}> {
  const supabase = await createClient();
  const cleanTerm = term.trim().toLowerCase();
  if (!cleanTerm) return { docs: [], pages: [] };

  // Search docs
  const { data: docsData } = await supabase
    .from("docs")
    .select("id, title, icon, description, updated_at")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .or(`title.ilike.%${cleanTerm}%,description.ilike.%${cleanTerm}%`)
    .limit(15);

  // Search pages
  const { data: pagesData } = await supabase
    .from("doc_pages")
    .select("id, doc_id, title, icon, content_markdown, docs!inner(title, workspace_id)")
    .eq("docs.workspace_id", workspaceId)
    .is("deleted_at", null)
    .or(`title.ilike.%${cleanTerm}%,content_markdown.ilike.%${cleanTerm}%`)
    .limit(20);

  const matchedDocs = (docsData || []).map((d) => ({
    id: d.id,
    title: d.title,
    icon: d.icon,
    snippet: d.description || "Document title match",
    updated_at: d.updated_at,
  }));

  const matchedPages = (pagesData || []).map((p: any) => {
    let snippet = "Page match";
    if (p.content_markdown) {
      const idx = p.content_markdown.toLowerCase().indexOf(cleanTerm);
      if (idx !== -1) {
        const start = Math.max(0, idx - 40);
        const end = Math.min(p.content_markdown.length, idx + cleanTerm.length + 60);
        snippet = `…${p.content_markdown.slice(start, end).replace(/\n/g, " ")}…`;
      }
    }
    return {
      id: p.id,
      doc_id: p.doc_id,
      title: p.title,
      icon: p.icon,
      snippet,
      doc_title: p.docs?.title || "Document",
    };
  });

  return { docs: matchedDocs, pages: matchedPages };
}
