import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateTextWithFallback } from "@/lib/ai/client";
import { PRESENTATION_TEMPLATES } from "@/lib/presentation/templates";

export interface GeneratedSlide {
  id: string;
  title: string;
  category: string;
  layout: "title" | "split" | "metrics" | "cards" | "timeline" | "quote";
  bullets?: string[];
  metrics?: { label: string; value: string; change?: string }[];
  cards?: { title: string; description: string; tag?: string }[];
  takeaway?: string;
}

export interface GeneratedPresentationDeck {
  title: string;
  subtitle: string;
  templateId: string;
  slides: GeneratedSlide[];
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const topic = (body.topic || "").trim();
    const projectId = body.projectId;
    const templateId = body.templateId || "pitch_sage";
    const slideCount = Math.min(10, Math.max(4, Number(body.slideCount) || 6));

    if (!topic && !projectId) {
      return NextResponse.json(
        { error: "Please provide a presentation topic or select a project." },
        { status: 400 }
      );
    }

    // Optional project grounding
    let projectContext = "";
    if (projectId) {
      const { data: project } = await supabase
        .from("projects")
        .select("id, name, description, status, target_date")
        .eq("id", projectId)
        .single();

      if (project) {
        const { data: tasks } = await supabase
          .from("tasks")
          .select("id, title, priority, status_category, due_date")
          .eq("project_id", projectId)
          .limit(30);

        const totalTasks = tasks?.length || 0;
        const completedTasks = tasks?.filter((t) => t.status_category === "completed").length || 0;
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        projectContext = `
PROJECT GROUNDING:
- Name: "${project.name}"
- Description: "${project.description || "N/A"}"
- Target Date: ${project.target_date || "Ongoing"}
- Tasks Total: ${totalTasks} (${completedTasks} completed, ${completionRate}% progress)
- Key Deliverables: ${tasks?.slice(0, 8).map((t) => t.title).join("; ") || "General Project Milestones"}
`;
      }
    }

    const selectedTemplate = PRESENTATION_TEMPLATES.find((t) => t.id === templateId) || PRESENTATION_TEMPLATES[0];

    const prompt = `
You are the AI Presentation Engine in Orbitwork (a modern project management & collaboration platform).
Create a professional, high-impact slide deck of exactly ${slideCount} slides based on:
TOPIC: "${topic || "Executive Project Status & Strategic Deck"}"
${projectContext}

TEMPLATE STYLE: ${selectedTemplate.name} (${selectedTemplate.tagline}, Archetype: ${selectedTemplate.archetype})

SLIDE STRUCTURE GUIDELINES:
1. Slide 1 MUST be layout "title": Main title, compelling subtitle, and 2-3 core thesis points.
2. Slide 2: Problem / Strategic Context (layout "split" or "cards").
3. Slide 3: Solution / Execution Strategy (layout "cards" or "split").
4. Slide 4: Key Metrics & Performance Milestones (layout "metrics" with 3-4 concrete numbers like "99.9%", "4.8x", "$1.2M", "14 Days", etc.).
5. Slide 5: Delivery Timeline / Roadmap (layout "timeline" with 3-4 chronological phases).
6. Slide 6+: Executive Takeaway & Next Actions (layout "split" or "quote").

Return ONLY valid, raw JSON conforming to this schema (do NOT wrap in markdown backticks or commentary):
{
  "title": "Short Main Title",
  "subtitle": "Subtitle explaining impact",
  "templateId": "${selectedTemplate.id}",
  "slides": [
    {
      "id": "slide-1",
      "title": "Slide Title",
      "category": "Title | Context | Metrics | Strategy | Roadmap | Conclusion",
      "layout": "title | split | metrics | cards | timeline | quote",
      "bullets": ["Point 1", "Point 2", "Point 3"],
      "metrics": [{"label": "Uptime", "value": "99.99%", "change": "+0.4%"}, {"label": "Velocity", "value": "2.4x"}],
      "cards": [{"title": "Pillar A", "description": "Details...", "tag": "Priority"}],
      "takeaway": "One-line executive takeaway"
    }
  ]
}
`;

    const aiRes = await generateTextWithFallback({
      prompt,
      temperature: 0.3,
      maxOutputTokens: 3500,
      system: "You are an executive slide designer. Return strictly parseable JSON.",
    });

    let cleaned = (aiRes.text || "").trim();
    if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
    if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
    if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();

    const deck = JSON.parse(cleaned) as GeneratedPresentationDeck;

    return NextResponse.json({ deck });
  } catch (err: any) {
    console.error("[Presentation Generator Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate presentation deck" },
      { status: 500 }
    );
  }
}
