import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { markdownToPdf } from "@/lib/pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string; documentId: string }> }) {
  const { projectId, documentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: document } = await supabase.from("project_documents").select("title, body_markdown").eq("id", documentId).eq("project_id", projectId).maybeSingle();
  if (!document) notFound();
  const filename = `${document.title.trim().replace(/[^a-z0-9-_]+/gi, "-").slice(0, 80) || "document"}.pdf`;
  return new Response(markdownToPdf(document.body_markdown, document.title), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
