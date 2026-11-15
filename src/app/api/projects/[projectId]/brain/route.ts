// src/app/api/projects/[projectId]/brain/route.ts
// Orbitwork Project Brain Core Intelligence API

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildProjectBrainContext } from "@/lib/brain/context-builder";
import {
  analyzeDependencies,
  analyzeWorkload,
  buildSmartProjectGraph,
  buildTimelineEvents,
  computeProjectHealth,
  computeWhyAtRisk,
  detectRisks,
  generateDeterministicRecommendations,
  generateTodayBrief,
} from "@/lib/brain/analytics";
import { generateAIProjectSummary } from "@/lib/brain/ai-service";
import type { ProjectBrainFullPayload } from "@/lib/brain/types";
import { isSchemaMissingError } from "@/lib/chat";

export const dynamic = "force-dynamic";

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

    const searchParams = req.nextUrl.searchParams;
    const forceRefresh = searchParams.get("refresh") === "true";

    // 1. Build Project Brain Context
    const brainData = await buildProjectBrainContext(projectId, user.id);

    if (!brainData || !brainData.projectExists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!brainData.hasAccess) {
      return NextResponse.json({ error: "Access denied to project" }, { status: 403 });
    }

    const { context, decisions, formattedLLMContext } = brainData;

    // 2. Check for recent cached snapshot (within last 10 minutes) unless forceRefresh is true
    if (!forceRefresh) {
      try {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { data: snapshot } = await supabase
          .from("project_brain_snapshots")
          .select("*")
          .eq("project_id", projectId)
          .gte("created_at", tenMinutesAgo)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (snapshot && snapshot.summary) {
          // Recompute deterministic lightweight views to ensure real-time graph & timeline
          const deps = analyzeDependencies(context);
          const workload = analyzeWorkload(context);
          const health = computeProjectHealth(context, deps, workload);
          const risks = detectRisks(context, deps, workload);
          const whyAtRisk = computeWhyAtRisk(context, health, risks, deps, workload);
          const todayBrief = generateTodayBrief(context, user.id, health, deps);
          const smartGraph = buildSmartProjectGraph(context, deps);
          const timeline = buildTimelineEvents(context.activity, context.profiles, context.tasks);
          const recommendations = generateDeterministicRecommendations(context, health, risks, deps, workload);

          const payload: ProjectBrainFullPayload = {
            projectId: context.projectId,
            projectName: context.projectName,
            projectDescription: "",
            projectDueDate: context.projectDueDate,
            projectCreatedAt: new Date().toISOString(),
            health,
            aiSummary: {
              text: snapshot.summary,
              generatedAt: snapshot.created_at,
              provider: "Orbitwork Brain Cache",
              isAiGenerated: true,
            },
            whyAtRisk,
            dependencies: deps,
            workload,
            risks,
            recommendations,
            decisions,
            timeline,
            todayBrief,
            smartGraph,
            hasInsufficientData: context.tasks.length === 0,
            insufficientDataReason:
              context.tasks.length === 0 ? "No tasks or goals currently exist in this project." : undefined,
          };

          return NextResponse.json(payload);
        }
      } catch (cacheErr) {
        // Fallback to live computation if table does not exist yet
      }
    }

    // 3. Compute Deterministic Intelligence Engine
    const deps = analyzeDependencies(context);
    const workload = analyzeWorkload(context);
    const health = computeProjectHealth(context, deps, workload);
    const risks = detectRisks(context, deps, workload);
    const whyAtRisk = computeWhyAtRisk(context, health, risks, deps, workload);
    const todayBrief = generateTodayBrief(context, user.id, health, deps);
    const smartGraph = buildSmartProjectGraph(context, deps);
    const timeline = buildTimelineEvents(context.activity, context.profiles, context.tasks);
    const recommendations = generateDeterministicRecommendations(context, health, risks, deps, workload);

    // 4. Generate AI Status Summary
    const aiSummary = await generateAIProjectSummary(
      context,
      health,
      risks,
      deps,
      workload,
      formattedLLMContext
    );

    // 5. Asynchronously persist snapshot in project_brain_snapshots if table is present
    try {
      await supabase.from("project_brain_snapshots").insert({
        project_id: projectId,
        health_score: health.overallScore,
        health_status: health.overallStatus,
        category_scores: health.categories,
        summary: aiSummary.text,
        why_at_risk: whyAtRisk.chain,
        key_risks: risks.slice(0, 5),
        recommended_actions: recommendations,
        dependency_insights: {
          blocked: deps.blockedTaskCount,
          blocking: deps.blockingTaskCount,
          cycles: deps.hasCircularDependencies,
        },
        workload_insights: workload.members,
        created_by: user.id,
      });
    } catch {
      // Ignore if table not yet migrated
    }

    const payload: ProjectBrainFullPayload = {
      projectId: context.projectId,
      projectName: context.projectName,
      projectDescription: "",
      projectDueDate: context.projectDueDate,
      projectCreatedAt: new Date().toISOString(),
      health,
      aiSummary: {
        text: aiSummary.text,
        generatedAt: new Date().toISOString(),
        provider: aiSummary.provider,
        isAiGenerated: aiSummary.isAiGenerated,
      },
      whyAtRisk,
      dependencies: deps,
      workload,
      risks,
      recommendations,
      decisions,
      timeline,
      todayBrief,
      smartGraph,
      hasInsufficientData: context.tasks.length === 0,
      insufficientDataReason:
        context.tasks.length === 0 ? "No tasks or goals currently exist in this project." : undefined,
    };

    return NextResponse.json(payload);
  } catch (err: unknown) {
    console.error("[Project Brain API GET Error]:", err);
    const msg = err instanceof Error ? err.message : "Internal error loading Project Brain";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
