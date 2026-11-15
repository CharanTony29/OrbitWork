import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const createAgentSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  description: z.string().max(300).optional(),
  trigger_type: z.enum(["on_subtask_created", "on_task_created", "on_status_change", "manual"]),
  action_type: z.enum(["auto_assign_parent", "generate_checklist", "estimate_time", "custom_agent"]),
  system_instructions: z.string().max(2000).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) return NextResponse.json({ error: "Missing projectId" }, { status: 400 });

    const { data, error } = await supabase
      .from("custom_ai_agents")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("[CustomAgents API] Select error:", error.message);
      return NextResponse.json({ agents: [] });
    }

    return NextResponse.json({ agents: data ?? [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error fetching agents";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = createAgentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid agent payload", details: parsed.error.format() }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("custom_ai_agents")
      .insert({
        project_id: parsed.data.projectId,
        name: parsed.data.name,
        description: parsed.data.description || "",
        trigger_type: parsed.data.trigger_type,
        action_type: parsed.data.action_type,
        system_instructions: parsed.data.system_instructions || "",
        enabled: true,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, agent: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create agent";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { agentId, enabled } = body;
    if (!agentId || typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Invalid patch payload" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("custom_ai_agents")
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq("id", agentId)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, agent: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update agent";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    if (!agentId) return NextResponse.json({ error: "Missing agentId" }, { status: 400 });

    const { error } = await supabase
      .from("custom_ai_agents")
      .delete()
      .eq("id", agentId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete agent";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
