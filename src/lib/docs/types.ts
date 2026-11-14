// src/lib/docs/types.ts
// Comprehensive TypeScript definitions for ClickUp-Style Collaborative Docs

export type DocBlockType =
  | "paragraph"
  | "heading_1"
  | "heading_2"
  | "heading_3"
  | "heading_4"
  | "bullet_list"
  | "numbered_list"
  | "checklist"
  | "quote"
  | "pull_quote"
  | "callout"
  | "banner"
  | "divider"
  | "code"
  | "table"
  | "image"
  | "video"
  | "audio"
  | "file"
  | "embed"
  | "toggle"
  | "columns"
  | "columns_3"
  | "task_reference"
  | "page_reference"
  | "person_reference"
  | "whiteboard_reference"
  | "clickup_list_table"
  | "clickup_list_board";

export interface DocBlock {
  id: string;
  type: DocBlockType;
  data: {
    text?: string;
    level?: number;
    checked?: boolean;
    language?: string;
    caption?: string;
    altText?: string;
    url?: string;
    width?: number | string;
    align?: "left" | "center" | "right" | "full";
    fileName?: string;
    fileSize?: number;
    calloutType?: "info" | "warning" | "success" | "tip" | "neutral";
    bannerType?: "info" | "warning" | "success" | "danger" | "neutral";
    bannerTitle?: string;
    author?: string;
    icon?: string;
    rows?: string[][];
    open?: boolean;
    colLeft?: string;
    colRight?: string;
    column1?: DocBlock[];
    column2?: DocBlock[];
    column3?: DocBlock[];
    taskId?: string;
    taskTitle?: string;
    taskStatus?: string;
    taskPriority?: string;
    pageId?: string;
    pageTitle?: string;
    userId?: string;
    userName?: string;
    userAvatar?: string;
    whiteboardId?: string;
    whiteboardTitle?: string;
    embedProvider?: "youtube" | "vimeo" | "figma" | "miro" | "generic";
    [key: string]: any;
  };
}

export interface DocItem {
  id: string;
  workspace_id: string;
  project_id?: string | null;
  title: string;
  icon: string;
  cover_url?: string | null;
  description: string;
  is_wiki: boolean;
  is_protected: boolean;
  is_private: boolean;
  is_archived: boolean;
  is_template: boolean;
  template_category?: string | null;
  is_published: boolean;
  public_slug?: string | null;
  published_at?: string | null;
  tags: string[];
  created_by?: string | null;
  updated_by?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  // Enriched
  creator_name?: string;
  creator_avatar?: string;
  project_name?: string;
  workspace_name?: string;
  pages_count?: number;
  is_favorited?: boolean;
}

export interface DocPageItem {
  id: string;
  doc_id: string;
  parent_page_id?: string | null;
  title: string;
  icon: string;
  cover_url?: string | null;
  position: number;
  content_json: DocBlock[];
  content_markdown: string;
  page_type: "standard" | "wiki" | "landing" | "documentation";
  is_archived: boolean;
  deleted_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PageListingNode {
  id: string;
  doc_id: string;
  parent_page_id: string | null;
  title: string;
  icon: string;
  position: number;
  has_children: boolean;
  children_count: number;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  children?: PageListingNode[];
}

export interface DocComment {
  id: string;
  doc_id: string;
  page_id: string;
  parent_comment_id?: string | null;
  author_id: string;
  author_name?: string;
  author_avatar?: string;
  content: string;
  selected_text?: string | null;
  block_id?: string | null;
  is_resolved: boolean;
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
  replies?: DocComment[];
}

export interface DocMember {
  id: string;
  doc_id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  user_avatar?: string;
  role: "owner" | "editor" | "commenter" | "viewer";
  created_at: string;
}

export interface DocActivity {
  id: string;
  doc_id: string;
  page_id?: string | null;
  actor_id?: string | null;
  actor_name?: string;
  action:
    | "created"
    | "updated"
    | "renamed"
    | "moved"
    | "archived"
    | "restored"
    | "deleted"
    | "published"
    | "unpublished"
    | "shared"
    | "commented"
    | "comment_resolved"
    | "version_restored";
  details: Record<string, any>;
  created_at: string;
}

export interface DocVersion {
  id: number;
  page_id: string;
  doc_id: string;
  title: string;
  content_json: DocBlock[];
  content_markdown: string;
  version_number: number;
  changed_by?: string | null;
  changer_name?: string;
  change_summary: string;
  created_at: string;
}

export interface DocTemplate {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  initialPages: {
    title: string;
    icon: string;
    blocks: DocBlock[];
    subpages?: {
      title: string;
      icon: string;
      blocks: DocBlock[];
    }[];
  }[];
}
