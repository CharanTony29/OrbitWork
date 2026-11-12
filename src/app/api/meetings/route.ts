import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isSchemaMissingError } from "@/lib/chat";

const createMeetingSchema = z.object({
  organizationId: z.string().uuid(),
  workspaceId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional().default(""),
  roomName: z.string().trim().min(1).max(120),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  meetingUrl: z.string().trim().max(500).optional().default(""),
  participantIds: z.array(z.string().uuid()).max(100).optional().default([]),
  instant: z.boolean().optional().default(false),
});

const updateMeetingSchema = z.object({
  meetingId: z.string().uuid(),
  status: z.enum(["scheduled", "live", "completed", "cancelled"]).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).optional(),
  roomName: z.string().trim().min(1).max(120).optional(),
  startTime: z.string().min(1).optional(),
  endTime: z.string().min(1).optional(),
  meetingUrl: z.string().trim().max(500).optional(),
  participantIds: z.array(z.string().uuid()).max(100).optional(),
});

function makeRoomCode() {
  return `orb-${crypto.randomUUID().slice(0, 8)}`;
}

async function getOrgMembership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  userId: string
) {
  const { data } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const organizationId = req.nextUrl.searchParams.get("organizationId");
  let query = supabase
    .from("meetings")
    .select(
      "id, organization_id, workspace_id, project_id, title, description, room_name, room_code, meeting_url, start_time, end_time, organizer_id, participant_ids, status, created_at, updated_at"
    )
    .order("start_time", { ascending: true });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;
  if (error) {
    if (isSchemaMissingError(error)) {
      return NextResponse.json({ meetings: [], schemaMissing: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ meetings: data ?? [], schemaMissing: false });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createMeetingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid meeting details.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const start = new Date(input.startTime);
  const end = new Date(input.endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return NextResponse.json(
      { error: "End time must be after start time." },
      { status: 400 }
    );
  }

  const membership = await getOrgMembership(supabase, input.organizationId, user.id);
  if (!membership) {
    return NextResponse.json(
      { error: "You must belong to this organization to book a room." },
      { status: 403 }
    );
  }

  // Check if the selected physical/virtual room already has an overlapping active booking
  const { data: conflicts, error: conflictError } = await supabase
    .from("meetings")
    .select("id, title, start_time, end_time")
    .eq("organization_id", input.organizationId)
    .ilike("room_name", input.roomName)
    .in("status", ["scheduled", "live"])
    .lt("start_time", end.toISOString())
    .gt("end_time", start.toISOString());

  if (conflictError && isSchemaMissingError(conflictError)) {
    return NextResponse.json(
      {
        error:
          "Meetings schema is not installed yet. Run supabase/migrations/202611120003_platform_enhancements.sql first.",
      },
      { status: 400 }
    );
  }

  if (!input.instant && (conflicts ?? []).length > 0) {
    const conflict = conflicts![0];
    return NextResponse.json(
      {
        error: `Room "${input.roomName}" is already booked for "${conflict.title}" during that time.`,
      },
      { status: 409 }
    );
  }

  const roomCode = makeRoomCode();
  const uniqueParticipants = Array.from(new Set([user.id, ...input.participantIds]));
  const meetingUrl = input.meetingUrl ? input.meetingUrl.trim() : "";

  const { data: created, error: insertError } = await supabase
    .from("meetings")
    .insert({
      organization_id: input.organizationId,
      workspace_id: input.workspaceId ?? null,
      project_id: input.projectId ?? null,
      title: input.title,
      description: input.description,
      room_name: input.roomName,
      room_code: roomCode,
      meeting_url: meetingUrl,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      organizer_id: user.id,
      participant_ids: uniqueParticipants,
      status: input.instant ? "live" : "scheduled",
    })
    .select(
      "id, organization_id, workspace_id, project_id, title, description, room_name, room_code, meeting_url, start_time, end_time, organizer_id, participant_ids, status, created_at, updated_at"
    )
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  // Notify invited participants inside Inbox / live toast bar
  const invitees = uniqueParticipants.filter((id) => id !== user.id);
  if (invitees.length > 0) {
    try {
      const admin = createAdminClient();
      if (admin) {
        const { data: organizerProfile } = await admin
          .from("profiles")
          .select("display_name, email")
          .eq("id", user.id)
          .maybeSingle();
        const organizerName =
          organizerProfile?.display_name ||
          organizerProfile?.email ||
          user.email ||
          "A teammate";

        await admin.from("notifications").insert(
          invitees.map((recipientId) => ({
            recipient_id: recipientId,
            actor_id: user.id,
            project_id: input.projectId ?? null,
            organization_id: input.organizationId,
            event_type: "meeting_scheduled",
            message: `${organizerName} scheduled "${input.title}" in ${input.roomName} (${start.toLocaleString()})`,
            action_url: `/planner?room=${roomCode}`,
          }))
        );
      }
    } catch (notifyErr) {
      console.error("[meetings] notification insert failed", notifyErr);
    }
  }

  return NextResponse.json({ meeting: created }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = updateMeetingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid update payload.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const { data: existing, error: fetchError } = await supabase
    .from("meetings")
    .select("id, organization_id, organizer_id")
    .eq("id", input.meetingId)
    .maybeSingle();

  if (fetchError) {
    if (isSchemaMissingError(fetchError)) {
      return NextResponse.json({ error: "Meetings schema missing." }, { status: 400 });
    }
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  }

  const membership = await getOrgMembership(supabase, existing.organization_id, user.id);
  const canManage =
    existing.organizer_id === user.id ||
    membership?.role === "owner" ||
    membership?.role === "admin";

  if (!canManage) {
    return NextResponse.json(
      { error: "Only the organizer or an organization admin can modify this meeting." },
      { status: 403 }
    );
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.status !== undefined) updates.status = input.status;
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.roomName !== undefined) updates.room_name = input.roomName;
  if (input.meetingUrl !== undefined) updates.meeting_url = input.meetingUrl;
  if (input.participantIds !== undefined) {
    updates.participant_ids = Array.from(
      new Set([existing.organizer_id, ...input.participantIds])
    );
  }
  if (input.startTime !== undefined) updates.start_time = new Date(input.startTime).toISOString();
  if (input.endTime !== undefined) updates.end_time = new Date(input.endTime).toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("meetings")
    .update(updates)
    .eq("id", input.meetingId)
    .select(
      "id, organization_id, workspace_id, project_id, title, description, room_name, room_code, meeting_url, start_time, end_time, organizer_id, participant_ids, status, created_at, updated_at"
    )
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ meeting: updated });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const meetingId = req.nextUrl.searchParams.get("meetingId");
  if (!meetingId) {
    return NextResponse.json({ error: "meetingId is required." }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("meetings")
    .select("id, organization_id, organizer_id")
    .eq("id", meetingId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  }

  const membership = await getOrgMembership(supabase, existing.organization_id, user.id);
  const canDelete =
    existing.organizer_id === user.id ||
    membership?.role === "owner" ||
    membership?.role === "admin";

  if (!canDelete) {
    return NextResponse.json(
      { error: "Only the organizer or an admin can cancel and remove this booking." },
      { status: 403 }
    );
  }

  const { error } = await supabase.from("meetings").delete().eq("id", meetingId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
