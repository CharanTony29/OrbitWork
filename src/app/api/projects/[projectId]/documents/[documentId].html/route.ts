import { createClient } from "@/lib/supabase/server";
import { markdownToSafeHtml } from "@/lib/markdown";

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string; documentId: string }> }) {
  const { projectId, documentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { data: document, error } = await supabase.from("project_documents").select("title, body_markdown, updated_at").eq("project_id", projectId).eq("id", documentId).maybeSingle();
  if (error || !document) return new Response("Document not found", { status: 404 });
  const title = escapeHtml(document.title);
  const body = markdownToSafeHtml(document.body_markdown);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>body{max-width:850px;margin:48px auto;padding:0 24px;font:16px/1.65 system-ui,sans-serif;color:#17231f}h1{font-size:2rem}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}blockquote{margin:1em 0;padding-left:1em;border-left:3px solid #b4cabb;color:#536158}code{padding:.1em .3em;background:#f0f3f0;border-radius:3px}hr{border:0;border-top:1px solid #dce4dd}</style></head><body><article><h1>${title}</h1>${body}</article></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": `attachment; filename="document-${documentId}.html"`, "Cache-Control": "private, no-store" } });
}
