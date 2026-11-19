import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateTextWithFallback } from "@/lib/ai/client";
import { normalizeMemberDesignations } from "@/lib/designations";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  projectId: z.string().uuid(),
  momText: z.string().min(10, "Meeting minutes text must be at least 10 characters").max(40000),
});

export type ExtractedMoMTask = {
  title: string;
  description: string;
  priority: "low" | "normal" | "high" | "urgent";
  dueDate: string | null;
  assigneeName?: string | null;
  assigneeUserId?: string | null;
  isExternal?: boolean;
  externalAssigneeName?: string | null;
  aiRoleMatch?: string | null;
  exists: boolean;
  existingTaskId?: string;
  existingTaskTitle?: string;
  duplicateReason?: string;
};

export interface TeamMemberInfo {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  designation: string;
  role?: string;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { projectId, momText } = parsed.data;

    // 1. Fetch existing tasks in this project to prevent duplicates
    const { data: existingTasks } = await supabase
      .from("tasks")
      .select("id, title, description, priority, due_date")
      .eq("project_id", projectId)
      .limit(200);

    const existingSummaryList = (existingTasks || []).map((t) => ({
      id: t.id,
      title: t.title.trim(),
      descPreview: (t.description || "").slice(0, 100),
    }));

    // 2. Fetch project members & organization members for potential assignee matching
    const { data: membersData } = await supabase
      .from("project_members")
      .select("user_id, role")
      .eq("project_id", projectId);

    let candidateUserIds = (membersData || []).map((m) => m.user_id);

    // Fallback: Query workspace and organization members if project_members is empty
    let orgId: string | null = null;
    if (candidateUserIds.length === 0) {
      const { data: project } = await supabase
        .from("projects")
        .select("workspaces ( organization_id )")
        .eq("id", projectId)
        .maybeSingle();

      const ws = Array.isArray(project?.workspaces)
        ? project?.workspaces[0]
        : project?.workspaces;
      orgId = ws?.organization_id ?? null;

      if (orgId) {
        const { data: orgMembers } = await supabase
          .from("organization_members")
          .select("user_id")
          .eq("organization_id", orgId)
          .eq("status", "active");
        candidateUserIds = (orgMembers || []).map((m) => m.user_id);
      }
    }

    if (candidateUserIds.length === 0) {
      candidateUserIds = [user.id];
    }

    // Deduplicate candidate IDs
    candidateUserIds = Array.from(new Set(candidateUserIds));

    // Query profiles from 'profiles' table (NOT user_profiles)
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, display_name, email, avatar_url, designation, designations")
      .in("id", candidateUserIds);

    const teamMembers: TeamMemberInfo[] = (profileRows || []).map((p) => {
      const desigs = normalizeMemberDesignations(p.designations, p.designation);
      return {
        id: p.id,
        name: p.display_name?.trim() || p.email?.split("@")[0] || "Teammate",
        email: p.email || "",
        avatarUrl: p.avatar_url || null,
        designation: desigs[0] || p.designation || "Member",
      };
    });

    // Extract detected attendees from text (e.g. "Attendees: Alex, Charan, Zav")
    const detectedExternalsSet = new Set<string>();
    const attendeeMatch = momText.match(/(?:Attendees|Participants|Present|In Attendance)[:\s]+([^\n\r]+)/i);
    if (attendeeMatch && attendeeMatch[1]) {
      const rawAttendees = attendeeMatch[1]
        .split(/[,;&|]/)
        .map((s) => s.trim().replace(/^[-*•]\s*/, ""))
        .filter((s) => s.length > 1 && !/^(and|etc|none)$/i.test(s));

      for (const att of rawAttendees) {
        const cleanName = att.replace(/\s*\([^)]*\)/g, "").trim();
        const isInternal = teamMembers.some(
          (m) =>
            m.name.toLowerCase() === cleanName.toLowerCase() ||
            m.name.toLowerCase().includes(cleanName.toLowerCase()) ||
            cleanName.toLowerCase().includes(m.name.toLowerCase())
        );
        if (!isInternal && cleanName.length > 1) {
          detectedExternalsSet.add(cleanName);
        }
      }
    }

    const teamMembersPromptList = teamMembers
      .map((m) => `- "${m.name}" (ID: ${m.id}, Role: ${m.designation}, Email: ${m.email})`)
      .join("\n");

    const systemPrompt = `You are an expert Project Management AI specialized in analyzing Minutes of Meetings (MoM), transcripts, and meeting notes.
Your task is to extract clear, actionable tasks from the meeting text, identify assignees (distinguishing internal TEAM MEMBERS from EXTERNAL STAKEHOLDERS), and check them against existing project tasks to detect duplicates.

IMPORTANT RULES ON ASSIGNEES & EXTERNALS:
1. INTERNAL TEAM MEMBERS:
   Check the provided list of TEAM MEMBERS. If an action item mentions someone on this list, match them to their exact "assigneeUserId" and "assigneeName".
2. EXTERNAL STAKEHOLDERS:
   Meeting attendees often include external stakeholders, clients, vendors, partners, or third parties (e.g. "Zav", "Siemens rep", "Catia consultant", "External contractor").
   If a person assigned or mentioned is NOT in the TEAM MEMBERS list:
   - Mark "isExternal": true.
   - Set "externalAssigneeName": Name of the external stakeholder (e.g. "Zav").
   - If co-assigned with an internal member (e.g. "Zav, Charan"), set "assigneeUserId" to the internal member ("Charan") AND set "isExternal": true with "externalAssigneeName": "Zav".
   - If ONLY an external person is assigned, set "assigneeUserId": null, "isExternal": true, "externalAssigneeName": "Zav".
3. AI ROLE RECOMMENDATION:
   - Provide "aiRoleMatch": "Developer" | "Tester" | "Support" | "Admin" | "HR" | "Manager".
4. DUPLICATE DETECTION:
   Compare each extracted task against the provided list of EXISTING PROJECT TASKS.
   - If an existing task already covers the same objective, feature, or bug (even with slightly different phrasing), mark "exists": true, provide "existingTaskId" and "existingTaskTitle", and give "duplicateReason".
   - If it is completely new work, mark "exists": false.

Output ONLY a valid JSON array of objects with the structure:
[
  {
    "title": "string",
    "description": "string",
    "priority": "low" | "normal" | "high" | "urgent",
    "dueDate": "YYYY-MM-DD" | null,
    "assigneeName": "string" | null,
    "assigneeUserId": "string" | null,
    "isExternal": boolean,
    "externalAssigneeName": "string" | null,
    "aiRoleMatch": "string",
    "exists": boolean,
    "existingTaskId": "string" | null,
    "existingTaskTitle": "string" | null,
    "duplicateReason": "string" | null
  }
]`;

    const compactExistingList = existingSummaryList
      .slice(0, 80)
      .map((t) => `${t.id}|${t.title}`)
      .join("\n");

    const userPrompt = `MEETING MINUTES:
"""
${momText.slice(0, 12000)}
"""

EXISTING TASKS (id|title):
${compactExistingList || "None"}

INTERNAL TEAM MEMBERS:
${teamMembersPromptList || "None"}`;

    let rawOutput = "";
    try {
      const aiResponse = await generateTextWithFallback({
        prompt: `${systemPrompt}\n\n${userPrompt}`,
        temperature: 0.2,
        maxOutputTokens: 1600,
      });
      rawOutput = aiResponse.text;
    } catch (aiErr) {
      console.warn("[MoM AI Error, falling back to smart heuristic parsing]:", aiErr);
    }

    let parsedTasks: ExtractedMoMTask[] = [];

    if (rawOutput) {
      try {
        const jsonMatch = rawOutput.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          parsedTasks = JSON.parse(jsonMatch[0]);
        }
      } catch (parseErr) {
        console.warn("Failed to parse AI JSON, falling back:", parseErr);
      }
    }

    // Heuristic Fallback if AI was unavailable or returned empty
    if (!parsedTasks || parsedTasks.length === 0) {
      const lines = momText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 5);

      for (const line of lines) {
        const isActionItem =
          /^[-*•]\s*(?:\[\s*\])?/i.test(line) ||
          /(?:todo|action item|task|follow up|deliverable|must|should|will do):/i.test(line) ||
          /^(?:1\.|2\.|3\.|4\.|5\.|6\.|7\.|8\.|9\.)/i.test(line);

        if (isActionItem) {
          const cleanedTitle = line
            .replace(/^[-*•]\s*(?:\[\s*\])?/i, "")
            .replace(/^(?:todo|action item|task|follow up|deliverable):\s*/i, "")
            .replace(/^\d+\.\s*/, "")
            .trim();

          if (cleanedTitle.length > 5) {
            // Check heuristic duplicate
            const lowerTitle = cleanedTitle.toLowerCase();
            const matchedExisting = existingSummaryList.find(
              (et) =>
                et.title.toLowerCase() === lowerTitle ||
                (lowerTitle.length > 10 && et.title.toLowerCase().includes(lowerTitle)) ||
                (et.title.length > 10 && lowerTitle.includes(et.title.toLowerCase()))
            );

            // Extract potential assignees mentioned in parenthesis or after names
            let detectedAssigneeName: string | null = null;
            let detectedUserId: string | null = null;
            let isExt = false;
            let extName: string | null = null;

            const parenMatch = line.match(/\(([^)]+)\)/);
            if (parenMatch && parenMatch[1]) {
              const insideParen = parenMatch[1];
              // Avoid non-assignee keywords like "high priority", "urgent"
              if (!/priority|urgent|p0|p1|eta|deadline|nov|dec|jan|feb|mar|apr|may|jun|jul|aug|sep|oct/i.test(insideParen)) {
                detectedAssigneeName = insideParen.trim();
              }
            }

            // Check if any team member matches
            if (detectedAssigneeName) {
              const parts = detectedAssigneeName.split(/[,/&]/).map((p) => p.trim());
              for (const part of parts) {
                const matchedMember = teamMembers.find(
                  (m) =>
                    m.name.toLowerCase() === part.toLowerCase() ||
                    part.toLowerCase().includes(m.name.toLowerCase()) ||
                    m.name.toLowerCase().includes(part.toLowerCase())
                );
                if (matchedMember) {
                  detectedUserId = matchedMember.id;
                } else if (part.length > 1) {
                  isExt = true;
                  extName = part;
                  detectedExternalsSet.add(part);
                }
              }
            }

            // Fallback: check if line directly mentions a team member name
            if (!detectedUserId) {
              const directMemberMatch = teamMembers.find((m) =>
                lowerTitle.includes(m.name.toLowerCase())
              );
              if (directMemberMatch) {
                detectedUserId = directMemberMatch.id;
                if (!detectedAssigneeName) detectedAssigneeName = directMemberMatch.name;
              }
            }

            parsedTasks.push({
              title: cleanedTitle,
              description: `Extracted from meeting minutes: "${line}"`,
              priority: /urgent|p0|asap|blocker/i.test(line)
                ? "urgent"
                : /high|p1/i.test(line)
                ? "high"
                : "normal",
              dueDate: null,
              assigneeName: detectedAssigneeName,
              assigneeUserId: detectedUserId,
              isExternal: isExt,
              externalAssigneeName: extName,
              aiRoleMatch: /test|qa|verify|check|cgr|jt/i.test(line) ? "Tester" : "Developer",
              exists: Boolean(matchedExisting),
              existingTaskId: matchedExisting?.id,
              existingTaskTitle: matchedExisting?.title,
              duplicateReason: matchedExisting
                ? `Matches existing task "${matchedExisting.title}"`
                : undefined,
            });
          }
        }
      }
    }

    // Safety check & refinement of parsed tasks
    parsedTasks = parsedTasks.map((t) => {
      let isExt = Boolean(t.isExternal);
      let extName = t.externalAssigneeName ?? null;
      let uid = t.assigneeUserId ?? null;

      // If assigneeName is set, verify against teamMembers
      if (t.assigneeName) {
        const parts = t.assigneeName.split(/[,/&]/).map((p) => p.trim());
        for (const part of parts) {
          const matched = teamMembers.find(
            (m) =>
              m.name.toLowerCase() === part.toLowerCase() ||
              m.name.toLowerCase().includes(part.toLowerCase()) ||
              part.toLowerCase().includes(m.name.toLowerCase())
          );
          if (matched && !uid) {
            uid = matched.id;
          } else if (!matched && part.length > 1) {
            isExt = true;
            if (!extName) extName = part;
            detectedExternalsSet.add(part);
          }
        }
      }

      // Check duplicates against existing tasks if not flagged
      if (!t.exists) {
        const lower = t.title.toLowerCase();
        const match = existingSummaryList.find((et) => {
          const etLower = et.title.toLowerCase();
          return (
            etLower === lower ||
            (lower.length > 10 && etLower.includes(lower)) ||
            (etLower.length > 10 && lower.includes(etLower))
          );
        });
        if (match) {
          return {
            ...t,
            assigneeUserId: uid,
            isExternal: isExt,
            externalAssigneeName: extName,
            exists: true,
            existingTaskId: match.id,
            existingTaskTitle: match.title,
            duplicateReason: `Similar task already exists: "${match.title}"`,
          };
        }
      }

      return {
        ...t,
        assigneeUserId: uid,
        isExternal: isExt,
        externalAssigneeName: extName,
      };
    });

    return NextResponse.json({
      success: true,
      tasks: parsedTasks,
      teamMembers,
      detectedExternals: Array.from(detectedExternalsSet),
      totalCount: parsedTasks.length,
      duplicateCount: parsedTasks.filter((t) => t.exists).length,
      newCount: parsedTasks.filter((t) => !t.exists).length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to process meeting minutes";
    console.error("[MoM Extraction Error]:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
