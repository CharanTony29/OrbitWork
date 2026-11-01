import { createClient } from "@/lib/supabase/server";
import { csvCell } from "@/lib/work";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const rows: { generated_key: string; title: string; description: string; status_id: string; priority: string; start_date: string | null; due_date: string | null; estimate_minutes: number | null; created_at: string }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("tasks").select("generated_key, title, description, status_id, priority, start_date, due_date, estimate_minutes, created_at").eq("project_id", projectId).order("created_at", { ascending: false }).range(offset, offset + 999);
    if (error) return new Response("Could not export tasks", { status: 403 });
    rows.push(...(data ?? []));
    if (!data || data.length < 1000 || rows.length >= 50000) break;
  }
  const header = ["Task ID", "Title", "Description", "Status ID", "Priority", "Start date", "Due date", "Estimate minutes", "Created at"];
  const body = rows.map((row) => [row.generated_key, row.title, row.description, row.status_id, row.priority, row.start_date, row.due_date, row.estimate_minutes, row.created_at].map(csvCell).join(","));
  return new Response([header.map(csvCell).join(","), ...body].join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="project-${projectId}-tasks.csv"`, "Cache-Control": "private, no-store" },
  });
}
