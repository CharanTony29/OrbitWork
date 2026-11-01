import { createClient } from "@/lib/supabase/server";
import { csvCell } from "@/lib/work";

type ReportRow = { status_name: string; task_count: number; completed_count: number; overdue_count: number; estimated_minutes: number; actual_minutes: number };

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { data, error } = await supabase.rpc("get_project_report_metrics", { target_project: projectId });
  if (error) return new Response("Report unavailable", { status: 403 });
  const header = ["Status", "Task count", "Completed", "Overdue", "Estimated minutes", "Actual minutes"];
  const metrics = (data ?? []) as ReportRow[];
  const rows = metrics.map((row) => [row.status_name, row.task_count, row.completed_count, row.overdue_count, row.estimated_minutes, row.actual_minutes].map(csvCell).join(","));
  return new Response([header.map(csvCell).join(","), ...rows].join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="project-${projectId}-report.csv"`, "Cache-Control": "private, no-store" } });
}
