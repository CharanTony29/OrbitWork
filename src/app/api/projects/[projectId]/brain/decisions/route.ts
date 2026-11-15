// src/app/api/projects/[projectId]/brain/decisions/route.ts
// Project Memory Decisions API

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSchemaMissingError } from "@/lib/chat";

export const dynamic = "force-dynamic";

const createDecisionSchema = z.object({
  title: z.string().trim().min(1).max(300),
  decisionDate: z.string().optional(),
  reason: z.string().trim().max(5000).optional().default(""),
  impact: z.string().trim().max(5000).optional().default(""),
  status: z.enum(["proposed", "accepted", "superseded", "deprecated", "rejected"]).default("accepted"),
  relatedTasks: z.array(z.string().uuid()).optional().default([]),
  relatedDocuments: z.array(z.string().uuid()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
});

export async function GET(
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

    const { data: canAccess } = await supabase.rpc("can_access_project", {
      target_project: projectId,
    });
    if (!canAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { data: decisions, error } = await supabase
      .from("project_decisions")
      .select("*")
      .eq("project_id", projectId)
      .order("decision_date", { ascending: false });

    if (error) {
      if (isSchemaMissingError(error)) {
        return NextResponse.json({ decisions: [], schemaMissing: true });
      }
      throw error;
    }

    return NextResponse.json({ decisions: decisions || [], schemaMissing: false });
  } catch (err: unknown) {
    console.error("[Project Brain Decisions GET Error]:", err);
    return NextResponse.json({ decisions: [], schemaMissing: true });
  }
}

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

    const { data: canEdit } = await supabase.rpc("can_edit_project_tasks", {
      target_project: projectId,
    });
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden: editor permissions required" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createDecisionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid decision payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { title, decisionDate, reason, impact, status, relatedTasks, relatedDocuments, tags } = parsed.data;

    const { data: inserted, error: insertError } = await supabase
      .from("project_decisions")
      .insert({
        project_id: projectId,
        title,
        decision_date: decisionDate || new Date().toISOString().split("T")[0],
        reason,
        impact,
        status,
        related_tasks: relatedTasks,
        related_documents: relatedDocuments,
        tags,
        decided_by: user.id,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      if (isSchemaMissingError(insertError)) {
        return NextResponse.json(
          {
            error: "Database table 'project_decisions' has not been created yet in Supabase.",
            schemaMissing: true,
          },
          { status: 400 }
        );
      }
      throw insertError;
    }

    // Also record event in project_activity_events for audit trail
    try {
      await supabase.from("project_activity_events").insert({
        project_id: projectId,
        actor_id: user.id,
        event_type: "decision_recorded",
        details: { title, status },
      });
    } catch {
      // Non-blocking
    }

    return NextResponse.json({ success: true, decision: inserted });
  } catch (err: unknown) {
    console.error("[Project Brain Decisions POST Error]:", err);
    const msg = err instanceof Error ? err.message : "Failed to record decision";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
