// src/app/api/projects/[projectId]/brain/impact/route.ts
// Interactive Change Impact Simulation API

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buildProjectBrainContext } from "@/lib/brain/context-builder";
import { analyzeDependencies, analyzeWorkload, simulateChangeImpact } from "@/lib/brain/analytics";

export const dynamic = "force-dynamic";

const impactRequestSchema = z.object({
  changeType: z.enum([
    "project_deadline",
    "task_due_date",
    "task_reassign",
    "task_status",
    "dependency_add",
    "dependency_remove",
    "task_priority",
  ]),
  taskId: z.string().optional(),
  newDate: z.string().optional(),
  newAssigneeId: z.string().optional(),
  newAssigneeName: z.string().optional(),
  newPriority: z.string().optional(),
  linkedTaskId: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = impactRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid impact simulation payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    // 1. Build Project Brain Context
    const brainData = await buildProjectBrainContext(projectId, user.id);

    if (!brainData || !brainData.projectExists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!brainData.hasAccess) {
      return NextResponse.json({ error: "Access denied to project" }, { status: 403 });
    }

    const { context } = brainData;

    // 2. Compute live dependencies & workload
    const deps = analyzeDependencies(context);
    const workload = analyzeWorkload(context);

    // 3. Simulate change impact
    const result = simulateChangeImpact(context, parsed.data, deps, workload);

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[Project Brain Impact API Error]:", err);
    const msg = err instanceof Error ? err.message : "Failed to calculate change impact";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
