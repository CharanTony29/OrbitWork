"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { distinctAssigneeIds, elapsedMinutes, parseEstimateToMinutes, parseInviteEmails } from "@/lib/work";
import {
  fetchOrGenerateCountryPublicHolidays,
  getCountryNameByCode,
} from "@/lib/publicHolidays";
import {
  notifyAssigneesOnTask,
  notifyRemovedAssigneesOnTask,
  notifyTaskCompletedToCreator,
  notifyMentionedUsers,
  checkAndSendDueDateReminders,
  checkAndNotifyHoursExhausting,
  sendOrganizationInvitationEmail,
} from "@/lib/email";

async function recordSubtaskAddedActivity({
  projectId,
  parentTaskId,
  subtaskId,
  actorId,
  title,
}: {
  projectId: string;
  parentTaskId: string;
  subtaskId: string;
  actorId: string;
  title: string;
}) {
  try {
    const adminClient = createAdminClient();
    if (!adminClient) return;
    await adminClient.from("project_activity_events").insert({
      project_id: projectId,
      task_id: parentTaskId,
      actor_id: actorId,
      event_type: "subtask_added",
      details: { subtask_id: subtaskId, title },
    });
  } catch (err) {
    console.warn("Failed to record subtask activity:", err);
  }
}

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});

function values(formData: FormData) {
  return credentialsSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
}

export async function signIn(formData: FormData) {
  const parsed = values(formData);
  const rawReturnUrl = formData.get("returnUrl") as string | null;
  const safeReturnUrl = rawReturnUrl && rawReturnUrl.startsWith("/") && !rawReturnUrl.startsWith("//") ? rawReturnUrl : "/dashboard";
  const returnQuery = rawReturnUrl ? `&returnUrl=${encodeURIComponent(rawReturnUrl)}` : "";

  if (!parsed.success) redirect(`/login?error=invalid_input${returnQuery}`);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect(`/login?error=sign_in_failed${returnQuery}`);

  // Automatically process any pending invitations for this user
  try {
    await supabase.rpc("accept_user_pending_invitations");
  } catch {}

  revalidatePath("/", "layout");
  redirect(safeReturnUrl);
}

export async function signUp(formData: FormData) {
  const parsed = values(formData);
  const rawReturnUrl = formData.get("returnUrl") as string | null;
  const safeReturnUrl = rawReturnUrl && rawReturnUrl.startsWith("/") && !rawReturnUrl.startsWith("//") ? rawReturnUrl : "/dashboard";
  const returnQuery = rawReturnUrl ? `&returnUrl=${encodeURIComponent(rawReturnUrl)}` : "";

  if (!parsed.success) redirect(`/signup?error=invalid_input${returnQuery}`);
  const supabase = await createClient();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(safeReturnUrl)}` },
  });
  if (error) redirect(`/signup?error=sign_up_failed${returnQuery}`);

  if (data?.session) {
    // Automatically process any pending invitations for this user
    try {
      await supabase.rpc("accept_user_pending_invitations");
    } catch {}
    revalidatePath("/", "layout");
    redirect(safeReturnUrl);
  }

  redirect(`/signup?message=check_email${returnQuery}`);
}

export async function signInWithMagicLink(formData: FormData) {
  const email = z.string().trim().email().safeParse(formData.get("email"));
  const fromSource = formData.get("from") === "signup" ? "/signup" : "/login";
  const rawReturnUrl = formData.get("returnUrl") as string | null;
  const safeReturnUrl = rawReturnUrl && rawReturnUrl.startsWith("/") && !rawReturnUrl.startsWith("//") ? rawReturnUrl : "/dashboard";
  const returnQuery = rawReturnUrl ? `&returnUrl=${encodeURIComponent(rawReturnUrl)}` : "";

  if (!email.success) redirect(`${fromSource}?error=invalid_input${returnQuery}`);
  const supabase = await createClient();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const emailRedirectTo = `${appUrl}/auth/callback?next=${encodeURIComponent(safeReturnUrl)}`;

  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: {
      emailRedirectTo,
      shouldCreateUser: true,
    },
  });

  if (error) {
    redirect(`${fromSource}?error=magic_link_failed${returnQuery}`);
  }

  redirect(`${fromSource}?message=magic_link_sent${returnQuery}`);
}

export async function toggleFavorite(formData: FormData): Promise<{ ok: boolean; favorited: boolean; error?: string }> {
  const parsed = z.object({
    entityType: z.enum(["document", "project", "task"]),
    entityId: z.string().uuid(),
    projectId: z.union([z.literal(""), z.string().uuid()]).optional(),
    title: z.string().trim().min(1).max(240),
    subtitle: z.string().trim().max(240).optional(),
  }).safeParse({
    entityType: formData.get("entityType"),
    entityId: formData.get("entityId"),
    projectId: formData.get("projectId") ?? "",
    title: formData.get("title") || "Untitled",
    subtitle: formData.get("subtitle") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, favorited: false, error: "Invalid favorite item." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, favorited: false, error: "Not signed in." };

  try {
    const { data: existing, error: selErr } = await supabase
      .from("user_favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("entity_type", parsed.data.entityType)
      .eq("entity_id", parsed.data.entityId)
      .maybeSingle();

    if (selErr) {
      return { ok: false, favorited: false, error: selErr.message };
    }

    if (existing?.id) {
      const { error: delErr } = await supabase
        .from("user_favorites")
        .delete()
        .eq("id", existing.id)
        .eq("user_id", user.id);
      if (delErr) return { ok: false, favorited: true, error: delErr.message };
      revalidatePath("/dashboard");
      revalidatePath("/my-dashboard");
      return { ok: true, favorited: false };
    }

    const { error: insErr } = await supabase.from("user_favorites").insert({
      user_id: user.id,
      entity_type: parsed.data.entityType,
      entity_id: parsed.data.entityId,
      project_id: parsed.data.projectId || null,
      title: parsed.data.title,
      subtitle: parsed.data.subtitle ?? "",
    });
    if (insErr) return { ok: false, favorited: false, error: insErr.message };
    revalidatePath("/dashboard");
    revalidatePath("/my-dashboard");
    return { ok: true, favorited: true };
  } catch (err) {
    return { ok: false, favorited: false, error: err instanceof Error ? err.message : "Could not toggle favorite." };
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function updateMyProfile(formData: FormData) {
  const parsed = z.object({
    displayName: z.string().trim().min(2).max(100),
    department: z.string().trim().max(100),
    designation: z.string().trim().max(100),
    contactInformation: z.string().trim().max(500),
  }).safeParse({
    displayName: formData.get("displayName"),
    department: formData.get("department") ?? "",
    designation: formData.get("designation") ?? "",
    contactInformation: formData.get("contactInformation") ?? "",
  });
  if (!parsed.success) redirect("/profile?error=invalid_profile");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { error } = await supabase.from("profiles").update({
    display_name: parsed.data.displayName,
    department: parsed.data.department || null,
    designation: parsed.data.designation || null,
    contact_information: parsed.data.contactInformation || null,
  }).eq("id", user.id);
  if (error) redirect("/profile?error=save_failed");
  await supabase.auth.updateUser({ data: { full_name: parsed.data.displayName } });
  revalidatePath("/", "layout");
  redirect("/profile?saved=1");
}

export async function updateMyAvatar(formData: FormData): Promise<{ ok: boolean; error?: string; avatarUrl?: string | null }> {
  const rawAvatar = String(formData.get("avatarDataUrl") ?? "").trim();
  if (rawAvatar) {
    const validPrefix = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(rawAvatar);
    if (!validPrefix || rawAvatar.length > 260_000) {
      return { ok: false, error: "Invalid image format or size too large (max ~180 KB after compression)." };
    }
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in first." };

  const nextUrl = rawAvatar || null;
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: nextUrl })
    .eq("id", user.id);

  if (error) {
    return { ok: false, error: "Could not update profile picture." };
  }

  revalidatePath("/", "layout");
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true, avatarUrl: nextUrl };
}

export async function changeMyPassword(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < 8 || newPassword.length > 128) {
    return { ok: false, error: "New password must be between 8 and 128 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, error: "New password and confirmation do not match." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (currentPassword && user.email) {
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyErr) {
      return { ok: false, error: "Current password is incorrect." };
    }
  }

  const { error: updateErr } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateErr) {
    return { ok: false, error: updateErr.message || "Could not update password." };
  }

  return { ok: true };
}

export async function deleteMyAccount(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const confirmText = String(formData.get("confirmText") ?? "").trim();
  if (confirmText !== "DELETE") {
    return { ok: false, error: 'Please type "DELETE" in the confirmation box.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const adminClient = createAdminClient();
  if (!adminClient) {
    return {
      ok: false,
      error: "Account erasure requires SUPABASE_SERVICE_ROLE_KEY to be configured on the server.",
    };
  }

  const userId = user.id;
  const userEmail = (user.email ?? "").trim().toLowerCase();

  // Attempt atomic DB erasure RPC first (from 202611110001 migration)
  const { error: rpcErr } = await adminClient.rpc("erase_user_account_data", {
    target_user_id: userId,
    target_email: userEmail,
  });

  if (rpcErr) {
    // Fallback explicit multi-table cleanup if migration RPC is not yet installed
    console.warn("erase_user_account_data RPC unavailable, running TypeScript erasure fallback:", rpcErr.message);
    try {
      await adminClient.from("user_favorites").delete().eq("user_id", userId);
      await adminClient.from("user_preferences").delete().eq("user_id", userId);
      await adminClient.from("project_channel_files").delete().eq("uploaded_by", userId);
      await adminClient.from("project_channel_posts").delete().eq("author_id", userId);
    } catch {}
    await adminClient.from("workspace_chat_messages").delete().or(`sender_id.eq.${userId},recipient_id.eq.${userId}`);
    await adminClient.from("notifications").delete().eq("recipient_id", userId);
    await adminClient.from("notifications").update({ actor_id: null }).eq("actor_id", userId);
    await adminClient.from("email_logs").delete().eq("recipient_id", userId);
    if (userEmail) {
      await adminClient.from("email_logs").delete().ilike("recipient_email", userEmail);
      await adminClient.from("invitations").delete().ilike("email", userEmail);
    }
    await adminClient.from("leave_requests").delete().eq("user_id", userId);
    await adminClient.from("leave_requests").update({ reviewed_by: null }).eq("reviewed_by", userId);
    await adminClient.from("timesheets").delete().eq("user_id", userId);
    await adminClient.from("timesheets").update({ reviewed_by: null }).eq("reviewed_by", userId);
    await adminClient.from("time_entries").delete().eq("user_id", userId);
    await adminClient.from("task_comments").delete().eq("author_id", userId);
    await adminClient.from("task_assignees").delete().eq("user_id", userId);
    await adminClient.from("tasks").update({ primary_assignee_id: null }).eq("primary_assignee_id", userId);
    await adminClient.from("tasks").update({ secondary_assignee_id: null }).eq("secondary_assignee_id", userId);
    await adminClient.from("checklist_items").update({ completed_by: null }).eq("completed_by", userId);

    // Handle organizations where user is member or creator
    const [{ data: memberOrgs }, { data: createdOrgs }] = await Promise.all([
      adminClient.from("organization_members").select("organization_id").eq("user_id", userId),
      adminClient.from("organizations").select("id").eq("created_by", userId),
    ]);
    const orgIds = [...new Set([
      ...(memberOrgs ?? []).map((m) => m.organization_id),
      ...(createdOrgs ?? []).map((o) => o.id),
    ])];

    for (const orgId of orgIds) {
      const { data: remainingMembers } = await adminClient
        .from("organization_members")
        .select("user_id, role, joined_at")
        .eq("organization_id", orgId)
        .eq("status", "active")
        .neq("user_id", userId)
        .order("joined_at", { ascending: true });

      const priorityOrder: Record<string, number> = { owner: 1, admin: 2, manager: 3, member: 4, viewer: 5 };
      const sorted = (remainingMembers ?? []).sort(
        (a, b) => (priorityOrder[a.role] ?? 9) - (priorityOrder[b.role] ?? 9)
      );
      const successor = sorted[0]?.user_id;

      const { data: orgWorkspaces } = await adminClient.from("workspaces").select("id").eq("organization_id", orgId);
      const wsIds = (orgWorkspaces ?? []).map((w) => w.id);
      const { data: orgProjects } = wsIds.length
        ? await adminClient.from("projects").select("id").in("workspace_id", wsIds)
        : { data: [] as Array<{ id: string }> };
      const projIds = (orgProjects ?? []).map((p) => p.id);

      if (!successor) {
        if (projIds.length > 0) {
          const { data: checklists } = await adminClient.from("task_checklists").select("id").in("project_id", projIds);
          const clIds = (checklists ?? []).map((c) => c.id);
          if (clIds.length) await adminClient.from("checklist_items").delete().in("checklist_id", clIds);
          await adminClient.from("task_comments").delete().in("project_id", projIds);
          await adminClient.from("task_attachments").delete().in("project_id", projIds);
          await adminClient.from("task_dependencies").delete().in("project_id", projIds);
          await adminClient.from("task_checklists").delete().in("project_id", projIds);
          await adminClient.from("task_custom_field_values").delete().in("project_id", projIds);
          await adminClient.from("custom_field_definitions").delete().in("project_id", projIds);
          await adminClient.from("task_assignees").delete().in("project_id", projIds);
          await adminClient.from("project_document_versions").delete().in("project_id", projIds);
          await adminClient.from("project_documents").delete().in("project_id", projIds);
          await adminClient.from("tasks").delete().in("project_id", projIds);
          await adminClient.from("projects").delete().in("id", projIds);
        }
        if (wsIds.length > 0) await adminClient.from("workspaces").delete().in("id", wsIds);
        await adminClient.from("organization_holidays").delete().eq("organization_id", orgId);
        await adminClient.from("google_drive_connections").delete().eq("organization_id", orgId);
        await adminClient.from("invitations").delete().eq("organization_id", orgId);
        await adminClient.from("organization_roles").delete().eq("organization_id", orgId);
        await adminClient.from("organizations").delete().eq("id", orgId);
      } else {
        await adminClient.from("organizations").update({ created_by: successor }).eq("id", orgId).eq("created_by", userId);
        await adminClient.from("organization_roles").update({ created_by: successor }).eq("organization_id", orgId).eq("created_by", userId);
        await adminClient.from("workspaces").update({ created_by: successor }).eq("organization_id", orgId).eq("created_by", userId);
        await adminClient.from("invitations").update({ invited_by: successor }).eq("organization_id", orgId).eq("invited_by", userId);
        await adminClient.from("organization_holidays").update({ created_by: successor }).eq("organization_id", orgId).eq("created_by", userId);
        await adminClient.from("google_drive_connections").update({ connected_by: successor }).eq("organization_id", orgId).eq("connected_by", userId);
        if (wsIds.length) {
          await adminClient.from("projects").update({ created_by: successor }).in("workspace_id", wsIds).eq("created_by", userId);
        }
        if (projIds.length) {
          await adminClient.from("tasks").update({ created_by: successor }).in("project_id", projIds).eq("created_by", userId);
          await adminClient.from("task_assignees").update({ assigned_by: successor }).in("project_id", projIds).eq("assigned_by", userId);
          await adminClient.from("custom_field_definitions").update({ created_by: successor }).in("project_id", projIds).eq("created_by", userId);
          await adminClient.from("task_custom_field_values").update({ updated_by: successor }).in("project_id", projIds).eq("updated_by", userId);
          await adminClient.from("task_dependencies").update({ created_by: successor }).in("project_id", projIds).eq("created_by", userId);
          await adminClient.from("task_checklists").update({ created_by: successor }).in("project_id", projIds).eq("created_by", userId);
          const { data: checklists } = await adminClient.from("task_checklists").select("id").in("project_id", projIds);
          const clIds = (checklists ?? []).map((c) => c.id);
          if (clIds.length) {
            await adminClient.from("checklist_items").update({ created_by: successor }).in("checklist_id", clIds).eq("created_by", userId);
          }
          await adminClient.from("task_attachments").update({ uploaded_by: successor }).in("project_id", projIds).eq("uploaded_by", userId);
          await adminClient.from("project_documents").update({ created_by: successor }).in("project_id", projIds).eq("created_by", userId);
          await adminClient.from("project_documents").update({ updated_by: successor }).in("project_id", projIds).eq("updated_by", userId);
        }
      }
    }

    await adminClient.from("project_members").delete().eq("user_id", userId);
    await adminClient.from("workspace_members").delete().eq("user_id", userId);
    await adminClient.from("organization_members").delete().eq("user_id", userId);
    await adminClient.from("project_document_versions").update({ changed_by: null }).eq("changed_by", userId);
    await adminClient.from("project_activity_events").update({ actor_id: null }).eq("actor_id", userId);
    await adminClient.from("audit_events").update({ actor_id: null, changes: {} }).eq("actor_id", userId);
    await adminClient.from("profiles").delete().eq("id", userId);
  }

  const { error: deleteAuthErr } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteAuthErr) {
    console.error("auth.admin.deleteUser failed:", deleteAuthErr);
    return { ok: false, error: `Could not erase auth account: ${deleteAuthErr.message}` };
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login?message=account_deleted");
}

export async function createOrganization(formData: FormData) {
  const name = z.string().trim().min(2).max(100).safeParse(formData.get("name"));
  if (!name.success) redirect("/dashboard?error=invalid_organization");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { error } = await supabase.rpc("create_organization", { organization_name: name.data });
  if (error) redirect("/dashboard?error=organization_failed");
  revalidatePath("/dashboard");
  redirect("/dashboard?organization_created=1");
}

export async function deleteOrganization(formData: FormData) {
  const parsed = z.object({ organizationId: z.string().uuid(), confirmName: z.string().trim().min(2).max(100) }).safeParse({ organizationId: formData.get("organizationId"), confirmName: formData.get("confirmName") });
  if (!parsed.success) redirect("/dashboard?error=organization_delete_confirmation");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: isOwner } = await supabase.rpc("has_org_role", { target_org: parsed.data.organizationId, allowed_roles: ["owner"] });
  if (!isOwner) redirect("/dashboard?error=organization_delete_forbidden");
  const { data: organization } = await supabase.from("organizations").select("name").eq("id", parsed.data.organizationId).maybeSingle();
  if (!organization || organization.name !== parsed.data.confirmName) redirect("/dashboard?error=organization_delete_confirmation");
  const { error } = await supabase.from("organizations").delete().eq("id", parsed.data.organizationId);
  if (error) redirect("/dashboard?error=organization_delete_failed");
  revalidatePath("/dashboard");
  redirect("/dashboard?organization_deleted=1");
}

export async function createWorkspace(formData: FormData) {
  const parsed = z.object({
    organizationId: z.string().uuid(),
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(500).optional(),
  }).safeParse({
    organizationId: formData.get("organizationId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) redirect("/dashboard?error=invalid_workspace");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { error } = await supabase.from("workspaces").insert({
    organization_id: parsed.data.organizationId,
    name: parsed.data.name,
    description: parsed.data.description ?? "",
    created_by: user.id,
  });
  if (error) redirect("/dashboard?error=workspace_failed");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function inviteOrganizationMember(formData: FormData) {
  const rawEmails = formData.getAll("email").map((v) => String(v).trim()).filter(Boolean).join(", ");
  const emailValue = rawEmails || String(formData.get("email") || "");

  const parsed = z.object({
    organizationId: z.string().uuid(),
    workspaceId: z.string().uuid().optional(),
    email: z.string().trim().min(1),
    role: z.enum(["admin", "manager", "member", "viewer"]),
  }).safeParse({
    organizationId: formData.get("organizationId"),
    workspaceId: formData.get("workspaceId") || undefined,
    email: emailValue,
    role: formData.get("role"),
  });

  const rawWorkspaceId = formData.get("workspaceId");
  const fallbackRedirect = rawWorkspaceId
    ? `/workspaces/${rawWorkspaceId}?error=invalid_invitation`
    : `/dashboard?error=invalid_invitation`;

  if (!parsed.success) redirect(fallbackRedirect);

  const emails = parseInviteEmails(parsed.data.email);
  if (!emails.length) redirect(fallbackRedirect);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: canInvite } = await supabase.rpc("has_org_role", {
    target_org: parsed.data.organizationId,
    allowed_roles: ["owner", "admin"],
  });
  if (!canInvite) {
    const forbiddenRedirect = parsed.data.workspaceId
      ? `/workspaces/${parsed.data.workspaceId}?error=invitation_forbidden`
      : `/dashboard?error=invitation_forbidden`;
    redirect(forbiddenRedirect);
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

  // Fetch organization and inviter profile once for all invitations
  const [{ data: org }, { data: inviterProfile }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", parsed.data.organizationId).maybeSingle(),
    supabase.from("profiles").select("display_name, email").eq("id", user.id).maybeSingle(),
  ]);
  const inviterName = inviterProfile?.display_name?.trim() || inviterProfile?.email || "An administrator";
  const organizationName = org?.name || "the organization";

  let successCount = 0;
  for (const recipientEmail of emails) {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const { error } = await supabase.from("invitations").insert({
      organization_id: parsed.data.organizationId,
      workspace_id: parsed.data.workspaceId ?? null,
      email: recipientEmail,
      role: parsed.data.role,
      token_hash: tokenHash,
      invited_by: user.id,
    });

    if (error) {
      console.error(`Failed to record invitation for ${recipientEmail}:`, error);
      continue;
    }

    const acceptUrl = `${appUrl}/invite/accept?token=${encodeURIComponent(token)}`;

    // Send invitation email separately to each recipient
    const emailRes = await sendOrganizationInvitationEmail({
      recipientEmail,
      inviterName,
      organizationName,
      acceptUrl,
    });

    if (!emailRes.ok) {
      // Optional fallback via supabase auth OTP if direct SMTP failed
      const emailRedirectTo = `${appUrl}/auth/callback?next=${encodeURIComponent(acceptUrl.replace(appUrl, ""))}`;
      const { error: mailError } = await supabase.auth.signInWithOtp({
        email: recipientEmail,
        options: { shouldCreateUser: true, emailRedirectTo },
      });
      if (mailError) {
        console.error(`Failed to send invitation email to ${recipientEmail}:`, mailError);
        await supabase.from("invitations").update({ status: "revoked" }).eq("token_hash", tokenHash);
        continue;
      }
    }

    successCount++;
  }

  if (successCount === 0) {
    const failedRedirect = parsed.data.workspaceId
      ? `/workspaces/${parsed.data.workspaceId}?error=invitation_failed`
      : `/dashboard?error=invitation_failed`;
    redirect(failedRedirect);
  }

  revalidatePath("/dashboard");
  if (parsed.data.workspaceId) {
    revalidatePath(`/workspaces/${parsed.data.workspaceId}`);
    redirect(`/workspaces/${parsed.data.workspaceId}?invited=${successCount}`);
  }
  redirect(`/dashboard?invited=${successCount}`);
}

export async function addWorkspaceMember(formData: FormData) {
  const parsed = z.object({
    workspaceId: z.string().uuid(), userId: z.string().uuid(), role: z.enum(["admin", "manager", "member", "viewer"]),
  }).safeParse({ workspaceId: formData.get("workspaceId"), userId: formData.get("userId"), role: formData.get("role") });
  if (!parsed.success) redirect("/dashboard?error=invalid_workspace_member");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: canManage } = await supabase.rpc("can_manage_workspace", { target_workspace: parsed.data.workspaceId });
  if (!canManage) redirect(`/workspaces/${parsed.data.workspaceId}?error=workspace_member_forbidden`);
  const { data: workspace } = await supabase.from("workspaces").select("organization_id").eq("id", parsed.data.workspaceId).maybeSingle();
  if (!workspace) redirect("/dashboard?error=workspace_not_found");
  const { data: isOrgAdmin } = await supabase.rpc("has_org_role", { target_org: workspace.organization_id, allowed_roles: ["owner", "admin"] });
  if (parsed.data.role === "admin" && !isOrgAdmin) redirect(`/workspaces/${parsed.data.workspaceId}?error=workspace_member_forbidden`);
  const { data: organizationMember } = await supabase.from("organization_members").select("user_id").eq("organization_id", workspace.organization_id).eq("user_id", parsed.data.userId).eq("status", "active").maybeSingle();
  if (!organizationMember) redirect(`/workspaces/${parsed.data.workspaceId}?error=workspace_member_not_in_org`);
  const { error } = await supabase.from("workspace_members").upsert({ organization_id: workspace.organization_id, workspace_id: parsed.data.workspaceId, user_id: parsed.data.userId, role: parsed.data.role, status: "active" }, { onConflict: "workspace_id,user_id" });
  if (error) redirect(`/workspaces/${parsed.data.workspaceId}?error=workspace_member_add_failed`);
  revalidatePath(`/workspaces/${parsed.data.workspaceId}`);
  revalidatePath("/dashboard");
  redirect(`/workspaces/${parsed.data.workspaceId}?member_added=1`);
}

export async function updateWorkspaceMemberRole(formData: FormData) {
  const parsed = z.object({
    workspaceId: z.string().uuid(),
    userId: z.string().uuid(),
    role: z.enum(["admin", "manager", "member", "viewer"]),
  }).safeParse({
    workspaceId: formData.get("workspaceId"),
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) redirect("/dashboard?error=invalid_workspace_member");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: canManage } = await supabase.rpc("can_manage_workspace", { target_workspace: parsed.data.workspaceId });
  if (!canManage) redirect(`/workspaces/${parsed.data.workspaceId}?error=workspace_member_forbidden`);
  const { data: workspace } = await supabase.from("workspaces").select("organization_id").eq("id", parsed.data.workspaceId).maybeSingle();
  if (!workspace) redirect("/dashboard?error=workspace_not_found");
  const { data: isOrgAdmin } = await supabase.rpc("has_org_role", { target_org: workspace.organization_id, allowed_roles: ["owner", "admin"] });
  if (parsed.data.role === "admin" && !isOrgAdmin) redirect(`/workspaces/${parsed.data.workspaceId}?error=workspace_member_forbidden`);

  const { error } = await supabase
    .from("workspace_members")
    .update({ role: parsed.data.role })
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("user_id", parsed.data.userId);

  if (error) redirect(`/workspaces/${parsed.data.workspaceId}?error=workspace_member_add_failed`);
  revalidatePath(`/workspaces/${parsed.data.workspaceId}`);
  redirect(`/workspaces/${parsed.data.workspaceId}?member_updated=1`);
}

export async function removeWorkspaceMember(formData: FormData) {
  const parsed = z.object({ workspaceId: z.string().uuid(), userId: z.string().uuid() }).safeParse({ workspaceId: formData.get("workspaceId"), userId: formData.get("userId") });
  if (!parsed.success) redirect("/dashboard?error=invalid_workspace_member");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: canManage } = await supabase.rpc("can_manage_workspace", { target_workspace: parsed.data.workspaceId });
  if (!canManage) redirect(`/workspaces/${parsed.data.workspaceId}?error=workspace_member_forbidden`);
  const { data: removed, error } = await supabase.from("workspace_members").delete().eq("workspace_id", parsed.data.workspaceId).eq("user_id", parsed.data.userId).select("user_id");
  if (error || !removed?.length) redirect(`/workspaces/${parsed.data.workspaceId}?error=workspace_member_remove_failed`);
  revalidatePath(`/workspaces/${parsed.data.workspaceId}`);
  revalidatePath("/dashboard");
  redirect(`/workspaces/${parsed.data.workspaceId}?member_removed=1`);
}

export async function updateOrganizationMemberRole(formData: FormData) {
  const parsed = z.object({
    organizationId: z.string().uuid(),
    userId: z.string().uuid(),
    role: z.enum(["admin", "manager", "member", "viewer"]),
  }).safeParse({
    organizationId: formData.get("organizationId"),
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) redirect("/dashboard?error=invalid_org_member");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: canManage } = await supabase.rpc("has_org_role", { target_org: parsed.data.organizationId, allowed_roles: ["owner", "admin"] });
  if (!canManage) redirect(`/organizations/${parsed.data.organizationId}/members?error=forbidden`);
  const { error } = await supabase.from("organization_members").update({ role: parsed.data.role }).eq("organization_id", parsed.data.organizationId).eq("user_id", parsed.data.userId);
  if (error) redirect(`/organizations/${parsed.data.organizationId}/members?error=update_failed`);
  revalidatePath(`/organizations/${parsed.data.organizationId}/members`);
  redirect(`/organizations/${parsed.data.organizationId}/members?member_updated=1`);
}

export async function createProject(formData: FormData) {
  const parsed = z.object({
    workspaceId: z.string().uuid(),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(2000).optional(),
  }).safeParse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) redirect("/dashboard?error=invalid_project");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { error } = await supabase.from("projects").insert({
    workspace_id: parsed.data.workspaceId,
    name: parsed.data.name,
    description: parsed.data.description ?? "",
    created_by: user.id,
  });
  if (error) redirect(`/workspaces/${parsed.data.workspaceId}?error=project_failed`);
  revalidatePath(`/workspaces/${parsed.data.workspaceId}`);
  redirect(`/workspaces/${parsed.data.workspaceId}`);
}

export async function toggleProjectActiveStatus(formData: FormData) {
  const parsed = z.object({
    projectId: z.string().uuid(),
    status: z.enum(["active", "archived", "on_hold", "completed"]),
    workspaceId: z.string().uuid().optional(),
  }).safeParse({
    projectId: formData.get("projectId"),
    status: formData.get("status"),
    workspaceId: formData.get("workspaceId") || undefined,
  });
  if (!parsed.success) redirect("/dashboard?error=invalid_status");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: canManage } = await supabase.rpc("can_manage_project", { target_project: parsed.data.projectId });
  if (!canManage) redirect(`/projects/${parsed.data.projectId}?error=project_forbidden`);

  const { error } = await supabase
    .from("projects")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.projectId);

  if (error) redirect(`/projects/${parsed.data.projectId}?error=project_update_failed`);
  revalidatePath(`/projects/${parsed.data.projectId}`);
  if (parsed.data.workspaceId) {
    revalidatePath(`/workspaces/${parsed.data.workspaceId}`);
    redirect(`/workspaces/${parsed.data.workspaceId}?status_updated=1`);
  }
  redirect(`/projects/${parsed.data.projectId}?status_updated=1`);
}


export async function createTask(formData: FormData) {
  const parsed = z.object({
    projectId: z.string().uuid(),
    title: z.string().trim().min(1).max(240),
    description: z.string().trim().max(10000).optional(),
    statusId: z.string().uuid(),
    priority: z.enum(["low", "normal", "high", "urgent"]),
    taskType: z.enum(["task", "improvement", "enhancement", "bug", "defect", "error", "issue", "milestone", "epic", "story", "subtask", "support_request", "research"]),
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
    estimateMinutes: z.union([z.string(), z.number()]).optional(),
  }).safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    statusId: formData.get("statusId"),
    priority: formData.get("priority") || "normal",
    taskType: formData.get("taskType") || "task",
    startDate: formData.get("startDate") || undefined,
    dueDate: formData.get("dueDate") || undefined,
    estimateMinutes: formData.get("estimateMinutes") || undefined,
  });
  if (!parsed.success) redirect("/dashboard?error=invalid_task");
  // Parse ordered assignee IDs from checkbox multi-select
  const rawAssigneeIds = formData.getAll("assigneeIds");
  const assigneeIds = rawAssigneeIds
    .map((id) => z.string().uuid().safeParse(id))
    .filter((r) => r.success)
    .map((r) => (r as { success: true; data: string }).data);
  const uniqueAssigneeIds = [...new Set(assigneeIds)].slice(0, 50);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const parsedEstimate = parsed.data.estimateMinutes ? parseEstimateToMinutes(parsed.data.estimateMinutes) : null;
  const tags = [...new Set(formData.getAll("tags").map((tag) => String(tag).trim().slice(0, 40)).filter(Boolean))].slice(0, 20);
  const { data: newTask, error } = await supabase.from("tasks").insert({
    project_id: parsed.data.projectId,
    status_id: parsed.data.statusId,
    title: parsed.data.title,
    description: parsed.data.description ?? "",
    priority: parsed.data.priority,
    task_type: parsed.data.taskType,
    tags,
    start_date: parsed.data.startDate ?? null,
    due_date: parsed.data.dueDate ?? null,
    estimate_minutes: parsedEstimate,
    primary_assignee_id: uniqueAssigneeIds[0] ?? null,
    secondary_assignee_id: uniqueAssigneeIds[1] ?? null,
    created_by: user.id,
  }).select("id").single();
  if (error || !newTask) redirect(`/projects/${parsed.data.projectId}?error=task_failed`);
  // Persist all assignees
  if (uniqueAssigneeIds.length > 0) {
    try {
      await supabase.from("task_assignees").delete().eq("project_id", parsed.data.projectId).eq("task_id", newTask.id);
      await supabase.from("task_assignees").insert(
        uniqueAssigneeIds.map((uid) => ({
          project_id: parsed.data.projectId,
          task_id: newTask.id,
          user_id: uid,
          assigned_by: user.id,
        }))
      );
    } catch (err) {
      console.warn("task_assignees sync in createTask:", err);
    }
    // Send email notification to assignees
    await notifyAssigneesOnTask({
      projectId: parsed.data.projectId,
      taskId: newTask.id,
      assigneeIds: uniqueAssigneeIds,
      actorId: user.id,
    });
  }
  revalidatePath(`/projects/${parsed.data.projectId}`);
  redirect(`/projects/${parsed.data.projectId}`);
}

export async function quickCreateTask(formData: FormData) {
  const parsed = z.object({
    projectId: z.string().uuid(),
    title: z.string().trim().min(1).max(240),
    statusId: z.string().uuid(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    dueDate: z.string().optional(),
    estimateMinutes: z.union([z.string(), z.number()]).optional(),
  }).safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    statusId: formData.get("statusId"),
    priority: (formData.get("priority") as "low" | "normal" | "high" | "urgent") || "normal",
    dueDate: formData.get("dueDate") || undefined,
    estimateMinutes: formData.get("estimateMinutes") || undefined,
  });

  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const rawAssigneeIds = formData.getAll("assigneeIds");
  const assigneeIds = rawAssigneeIds
    .map((id) => z.string().uuid().safeParse(id))
    .filter((r) => r.success)
    .map((r) => (r as { success: true; data: string }).data);
  const uniqueAssigneeIds = [...new Set(assigneeIds)].slice(0, 50);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const parsedEstimate = parsed.data.estimateMinutes ? parseEstimateToMinutes(parsed.data.estimateMinutes) : null;

  const { data: newTask, error } = await supabase.from("tasks").insert({
    project_id: parsed.data.projectId,
    status_id: parsed.data.statusId,
    title: parsed.data.title,
    description: "",
    priority: parsed.data.priority || "normal",
    start_date: null,
    due_date: parsed.data.dueDate || null,
    estimate_minutes: parsedEstimate,
    primary_assignee_id: uniqueAssigneeIds[0] ?? null,
    secondary_assignee_id: uniqueAssigneeIds[1] ?? null,
    created_by: user.id,
  }).select("id").single();

  if (error || !newTask) return { ok: false, error: "create_failed" };

  if (uniqueAssigneeIds.length > 0) {
    try {
      await supabase.from("task_assignees").delete().eq("project_id", parsed.data.projectId).eq("task_id", newTask.id);
      await supabase.from("task_assignees").insert(
        uniqueAssigneeIds.map((uid) => ({
          project_id: parsed.data.projectId,
          task_id: newTask.id,
          user_id: uid,
          assigned_by: user.id,
        }))
      );
    } catch (err) {
      console.warn("task_assignees sync in quickCreateTask:", err);
    }
    // Send email notification to assignees
    await notifyAssigneesOnTask({
      projectId: parsed.data.projectId,
      taskId: newTask.id,
      assigneeIds: uniqueAssigneeIds,
      actorId: user.id,
    });
  }

  revalidatePath(`/projects/${parsed.data.projectId}`);
  return { ok: true, taskId: newTask.id };
}

export async function updateTaskStatus(formData: FormData) {
  const parsed = z.object({ taskId: z.string().uuid(), projectId: z.string().uuid(), statusId: z.string().uuid() }).safeParse({
    taskId: formData.get("taskId"), projectId: formData.get("projectId"), statusId: formData.get("statusId"),
  });
  if (!parsed.success) redirect("/dashboard?error=invalid_task");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: prevTask } = await supabase
    .from("tasks")
    .select("status_id, parent_task_id")
    .eq("id", parsed.data.taskId)
    .eq("project_id", parsed.data.projectId)
    .maybeSingle();
  const { error } = await supabase.from("tasks").update({ status_id: parsed.data.statusId }).eq("id", parsed.data.taskId).eq("project_id", parsed.data.projectId);
  if (error) redirect(`/projects/${parsed.data.projectId}?error=status_failed`);
  await notifyTaskCompletedToCreator({
    projectId: parsed.data.projectId,
    taskId: parsed.data.taskId,
    newStatusId: parsed.data.statusId,
    previousStatusId: prevTask?.status_id ?? null,
    actorId: user.id,
  });
  revalidatePath(`/projects/${parsed.data.projectId}`);
  revalidatePath(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}`);
  if (prevTask?.parent_task_id) {
    revalidatePath(`/projects/${parsed.data.projectId}/tasks/${prevTask.parent_task_id}`);
  }
}

export async function updateTaskAssignees(formData: FormData) {
  const parsed = z.object({
    projectId: z.string().uuid(),
    taskId: z.string().uuid(),
    primaryAssigneeId: z.union([z.literal(""), z.string().uuid()]),
    secondaryAssigneeId: z.union([z.literal(""), z.string().uuid()]),
  }).safeParse({
    projectId: formData.get("projectId"),
    taskId: formData.get("taskId"),
    primaryAssigneeId: formData.get("primaryAssigneeId") ?? "",
    secondaryAssigneeId: formData.get("secondaryAssigneeId") ?? "",
  });
  if (!parsed.success || (parsed.data.primaryAssigneeId && parsed.data.primaryAssigneeId === parsed.data.secondaryAssigneeId)) return { ok: false };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [{ data: existingTask }, { data: existingRows }] = await Promise.all([
    supabase
      .from("tasks")
      .select("primary_assignee_id, secondary_assignee_id")
      .eq("id", parsed.data.taskId)
      .eq("project_id", parsed.data.projectId)
      .maybeSingle(),
    supabase
      .from("task_assignees")
      .select("user_id")
      .eq("task_id", parsed.data.taskId)
      .eq("project_id", parsed.data.projectId),
  ]);

  const previousSet = new Set<string>();
  if (existingTask?.primary_assignee_id) previousSet.add(existingTask.primary_assignee_id);
  if (existingTask?.secondary_assignee_id) previousSet.add(existingTask.secondary_assignee_id);
  for (const row of existingRows ?? []) {
    if (row.user_id) previousSet.add(row.user_id);
  }

  const { error } = await supabase.from("tasks").update({
    primary_assignee_id: parsed.data.primaryAssigneeId || null,
    secondary_assignee_id: parsed.data.secondaryAssigneeId || null,
  }).eq("id", parsed.data.taskId).eq("project_id", parsed.data.projectId);
  if (error) return { ok: false };

  const assignees = [parsed.data.primaryAssigneeId, parsed.data.secondaryAssigneeId].filter(Boolean) as string[];
  const nextSet = new Set(assignees);

  try {
    await supabase
      .from("task_assignees")
      .delete()
      .eq("project_id", parsed.data.projectId)
      .eq("task_id", parsed.data.taskId);
    if (assignees.length > 0) {
      await supabase.from("task_assignees").insert(
        assignees.map((uid) => ({
          project_id: parsed.data.projectId,
          task_id: parsed.data.taskId,
          user_id: uid,
          assigned_by: user.id,
        }))
      );
    }
  } catch (syncErr) {
    console.warn("task_assignees sync in updateTaskAssignees warning:", syncErr);
  }

  const addedIds = assignees.filter((id) => !previousSet.has(id));
  const removedIds = [...previousSet].filter((id) => !nextSet.has(id));

  if (addedIds.length > 0) {
    await notifyAssigneesOnTask({
      projectId: parsed.data.projectId,
      taskId: parsed.data.taskId,
      assigneeIds: addedIds,
      actorId: user.id,
    });
  }

  if (removedIds.length > 0) {
    await notifyRemovedAssigneesOnTask({
      projectId: parsed.data.projectId,
      taskId: parsed.data.taskId,
      removedAssigneeIds: removedIds,
      actorId: user.id,
    });
  }

  revalidatePath(`/projects/${parsed.data.projectId}`);
  revalidatePath(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}`);
  revalidatePath("/dashboard");
  revalidatePath("/my-dashboard");
  return { ok: true };
}

export async function setTaskAssignees(formData: FormData) {
  const projectId = z.string().uuid().safeParse(formData.get("projectId"));
  const taskId = z.string().uuid().safeParse(formData.get("taskId"));
  if (!projectId.success || !taskId.success) return { ok: false };
  const rawIds = formData.getAll("assigneeIds");
  const assigneeIds = rawIds
    .map((id) => z.string().uuid().safeParse(id))
    .filter((r) => r.success)
    .map((r) => (r as { success: true; data: string }).data);
  // Remove duplicates while preserving order
  const uniqueIds = [...new Set(assigneeIds)];
  if (uniqueIds.length > 50) return { ok: false };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const [{ data: existingTask }, { data: existingRows }] = await Promise.all([
    supabase
      .from("tasks")
      .select("primary_assignee_id, secondary_assignee_id")
      .eq("id", taskId.data)
      .eq("project_id", projectId.data)
      .maybeSingle(),
    supabase
      .from("task_assignees")
      .select("user_id")
      .eq("task_id", taskId.data)
      .eq("project_id", projectId.data),
  ]);

  const previousSet = new Set<string>();
  if (existingTask?.primary_assignee_id) previousSet.add(existingTask.primary_assignee_id);
  if (existingTask?.secondary_assignee_id) previousSet.add(existingTask.secondary_assignee_id);
  for (const row of existingRows ?? []) {
    if (row.user_id) previousSet.add(row.user_id);
  }

  // Directly update primary and secondary assignee on the tasks table
  const { error: taskError } = await supabase
    .from("tasks")
    .update({
      primary_assignee_id: uniqueIds[0] || null,
      secondary_assignee_id: uniqueIds[1] || null,
    })
    .eq("id", taskId.data)
    .eq("project_id", projectId.data);

  if (taskError) {
    console.error("setTaskAssignees failed to update tasks table:", taskError);
    return { ok: false };
  }

  // Also sync task_assignees table for any multi-assignee lookups
  try {
    await supabase
      .from("task_assignees")
      .delete()
      .eq("project_id", projectId.data)
      .eq("task_id", taskId.data);

    if (uniqueIds.length > 0) {
      await supabase.from("task_assignees").insert(
        uniqueIds.map((uid) => ({
          project_id: projectId.data,
          task_id: taskId.data,
          user_id: uid,
          assigned_by: user.id,
        }))
      );
    }
  } catch (syncErr) {
    console.warn("task_assignees table sync warning:", syncErr);
  }

  const nextSet = new Set(uniqueIds);
  const addedIds = uniqueIds.filter((id) => !previousSet.has(id));
  const removedIds = [...previousSet].filter((id) => !nextSet.has(id));

  if (addedIds.length > 0) {
    await notifyAssigneesOnTask({
      projectId: projectId.data,
      taskId: taskId.data,
      assigneeIds: addedIds,
      actorId: user.id,
    });
  }

  if (removedIds.length > 0) {
    await notifyRemovedAssigneesOnTask({
      projectId: projectId.data,
      taskId: taskId.data,
      removedAssigneeIds: removedIds,
      actorId: user.id,
    });
  }

  revalidatePath(`/projects/${projectId.data}`);
  revalidatePath(`/projects/${projectId.data}/tasks/${taskId.data}`);
  return { ok: true };
}

export async function updateTaskField(formData: FormData) {
  const base = z.object({
    taskId: z.string().uuid(),
    projectId: z.string().uuid(),
    field: z.enum(["title", "priority", "due_date", "estimate_minutes"]),
  }).safeParse({
    taskId: formData.get("taskId"),
    projectId: formData.get("projectId"),
    field: formData.get("field"),
  });
  if (!base.success) redirect("/dashboard?error=invalid_task");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  {
    const rawValue = formData.get("value");
    let update: { title?: string; priority?: "low" | "normal" | "high" | "urgent"; due_date?: string | null; estimate_minutes?: number | null };
    if (base.data.field === "title") {
      const value = z.string().trim().min(1).max(240).safeParse(rawValue);
      if (!value.success) redirect(`/projects/${base.data.projectId}?error=invalid_task_title`);
      update = { title: value.data };
    } else if (base.data.field === "priority") {
      const value = z.enum(["low", "normal", "high", "urgent"]).safeParse(rawValue);
      if (!value.success) redirect(`/projects/${base.data.projectId}?error=invalid_task_priority`);
      update = { priority: value.data };
    } else if (base.data.field === "due_date") {
      const value = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).safeParse(rawValue);
      if (!value.success) redirect(`/projects/${base.data.projectId}?error=invalid_due_date`);
      update = { due_date: value.data || null };
    } else {
      const rawStr = rawValue == null ? "" : String(rawValue).trim();
      let est: number | null = null;
      if (rawStr !== "") {
        est = parseEstimateToMinutes(rawStr);
        if (est == null) redirect(`/projects/${base.data.projectId}?error=invalid_estimate`);
      }
      update = { estimate_minutes: est };
    }
    const { error } = await supabase.from("tasks").update(update).eq("id", base.data.taskId).eq("project_id", base.data.projectId);
    if (error) redirect(`/projects/${base.data.projectId}?error=task_update_failed`);
    if (base.data.field === "estimate_minutes") {
      await checkAndNotifyHoursExhausting({
        projectId: base.data.projectId,
        taskId: base.data.taskId,
      });
    }
  }
  revalidatePath(`/projects/${base.data.projectId}`);
}

export async function autoSaveTaskProperty(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const base = z.object({
    taskId: z.string().uuid(),
    projectId: z.string().uuid(),
    field: z.enum(["status_id", "priority", "start_date", "due_date", "estimate_minutes"]),
  }).safeParse({
    taskId: formData.get("taskId"),
    projectId: formData.get("projectId"),
    field: formData.get("field"),
  });
  if (!base.success) return { ok: false, error: "Invalid property request." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const rawValue = formData.get("value");
  const strVal = rawValue == null ? "" : String(rawValue).trim();

  const update: {
    status_id?: string;
    priority?: "low" | "normal" | "high" | "urgent";
    start_date?: string | null;
    due_date?: string | null;
    estimate_minutes?: number | null;
  } = {};

  if (base.data.field === "status_id") {
    const val = z.string().uuid().safeParse(strVal);
    if (!val.success) return { ok: false, error: "Invalid status." };
    update.status_id = val.data;
  } else if (base.data.field === "priority") {
    const val = z.enum(["low", "normal", "high", "urgent"]).safeParse(strVal);
    if (!val.success) return { ok: false, error: "Invalid priority." };
    update.priority = val.data;
  } else if (base.data.field === "start_date") {
    if (strVal !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(strVal)) {
      return { ok: false, error: "Invalid start date." };
    }
    update.start_date = strVal || null;
  } else if (base.data.field === "due_date") {
    if (strVal !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(strVal)) {
      return { ok: false, error: "Invalid due date." };
    }
    update.due_date = strVal || null;
  } else {
    let est: number | null = null;
    if (strVal !== "") {
      est = parseEstimateToMinutes(strVal);
      if (est == null) return { ok: false, error: "Invalid estimate format (use e.g. 2h, 1d, 30m)." };
    }
    update.estimate_minutes = est;
  }

  const previousStatusId =
    base.data.field === "status_id"
      ? (
          await supabase
            .from("tasks")
            .select("status_id")
            .eq("id", base.data.taskId)
            .eq("project_id", base.data.projectId)
            .maybeSingle()
        ).data?.status_id ?? null
      : null;

  const { error } = await supabase
    .from("tasks")
    .update(update)
    .eq("id", base.data.taskId)
    .eq("project_id", base.data.projectId);

  if (error) {
    return {
      ok: false,
      error: "Could not save property. Check that due date is not before start date.",
    };
  }

  if (base.data.field === "status_id" && update.status_id) {
    await notifyTaskCompletedToCreator({
      projectId: base.data.projectId,
      taskId: base.data.taskId,
      newStatusId: update.status_id,
      previousStatusId,
      actorId: user.id,
    });
  }

  if (base.data.field === "estimate_minutes") {
    await checkAndNotifyHoursExhausting({
      projectId: base.data.projectId,
      taskId: base.data.taskId,
    });
  }

  revalidatePath(`/projects/${base.data.projectId}`);
  revalidatePath(`/projects/${base.data.projectId}/tasks/${base.data.taskId}`);
  revalidatePath("/dashboard");
  revalidatePath("/my-dashboard");
  return { ok: true };
}

export async function updateTask(formData: FormData) {
  const parsed = z.object({
    projectId: z.string().uuid(),
    taskId: z.string().uuid(),
    title: z.string().trim().min(1).max(240),
    description: z.string().trim().max(10000),
    statusId: z.string().uuid().optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
    estimateMinutes: z.union([z.string(), z.number()]).optional(),
  }).safeParse({
    projectId: formData.get("projectId"),
    taskId: formData.get("taskId"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    statusId: formData.get("statusId") || undefined,
    priority: formData.get("priority") || undefined,
    startDate: formData.get("startDate") || undefined,
    dueDate: formData.get("dueDate") || undefined,
    estimateMinutes: formData.get("estimateMinutes") ?? undefined,
  });
  if (!parsed.success) redirect("/dashboard?error=invalid_task");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const updatePayload: Record<string, unknown> = {
    title: parsed.data.title,
    description: parsed.data.description,
  };
  if (parsed.data.statusId) updatePayload.status_id = parsed.data.statusId;
  if (parsed.data.priority) updatePayload.priority = parsed.data.priority;
  if (formData.has("startDate")) updatePayload.start_date = parsed.data.startDate ?? null;
  if (formData.has("dueDate")) updatePayload.due_date = parsed.data.dueDate ?? null;
  if (formData.has("estimateMinutes")) {
    const rawEst = parsed.data.estimateMinutes;
    const estString = rawEst == null ? "" : String(rawEst).trim();
    updatePayload.estimate_minutes = estString !== "" ? parseEstimateToMinutes(estString) : null;
  }

  const prevStatusId = parsed.data.statusId
    ? (
        await supabase
          .from("tasks")
          .select("status_id")
          .eq("id", parsed.data.taskId)
          .eq("project_id", parsed.data.projectId)
          .maybeSingle()
      ).data?.status_id ?? null
    : null;

  const { error } = await supabase.from("tasks").update(updatePayload).eq("id", parsed.data.taskId).eq("project_id", parsed.data.projectId);
  if (error) redirect(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}?error=save_failed`);
  if (parsed.data.statusId) {
    await notifyTaskCompletedToCreator({
      projectId: parsed.data.projectId,
      taskId: parsed.data.taskId,
      newStatusId: parsed.data.statusId,
      previousStatusId: prevStatusId,
      actorId: user.id,
    });
  }
  await checkAndNotifyHoursExhausting({
    projectId: parsed.data.projectId,
    taskId: parsed.data.taskId,
  });
  revalidatePath(`/projects/${parsed.data.projectId}`);
  revalidatePath(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}`);
  revalidatePath("/dashboard");
  revalidatePath("/my-dashboard");
  redirect(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}?saved=1`);
}

export async function createTaskComment(formData: FormData) {
  const parsed = z.object({ projectId: z.string().uuid(), taskId: z.string().uuid(), body: z.string().trim().min(1).max(10000) }).safeParse({
    projectId: formData.get("projectId"), taskId: formData.get("taskId"), body: formData.get("body"),
  });
  if (!parsed.success) redirect("/dashboard?error=invalid_comment");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { error } = await supabase.from("task_comments").insert({
    project_id: parsed.data.projectId,
    task_id: parsed.data.taskId,
    author_id: user.id,
    body: parsed.data.body,
  });
  if (error) redirect(`/projects/${parsed.data.projectId}?error=comment_failed`);

  // Notify mentioned users via email
  await notifyMentionedUsers({
    projectId: parsed.data.projectId,
    taskId: parsed.data.taskId,
    commentBody: parsed.data.body,
    authorId: user.id,
  });

  revalidatePath(`/projects/${parsed.data.projectId}`);
}

export async function triggerDueDateReminders(formData: FormData) {
  const projectId = formData.get("projectId") ? String(formData.get("projectId")) : undefined;
  const result = await checkAndSendDueDateReminders(projectId);
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
  }
  return result;
}

export async function createProjectStatus(formData: FormData) {
  const parsed = z.object({
    projectId: z.string().uuid(),
    name: z.string().trim().min(1).max(40),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    category: z.enum(["not_started", "active", "completed", "cancelled"]),
  }).safeParse({
    projectId: formData.get("projectId"), name: formData.get("name"),
    color: formData.get("color"), category: formData.get("category"),
  });
  if (!parsed.success) redirect("/dashboard?error=invalid_status");
  const supabase = await createClient();
  const { data: statuses } = await supabase.from("project_statuses").select("position").eq("project_id", parsed.data.projectId).order("position", { ascending: false }).limit(1);
  const { error } = await supabase.from("project_statuses").insert({
    project_id: parsed.data.projectId, name: parsed.data.name, color: parsed.data.color,
    category: parsed.data.category, position: (statuses?.[0]?.position ?? -1) + 1,
  });
  if (error) redirect(`/projects/${parsed.data.projectId}?error=status_create_failed`);
  revalidatePath(`/projects/${parsed.data.projectId}`);
  redirect(`/projects/${parsed.data.projectId}`);
}

export async function updateProjectStatus(formData: FormData) {
  const parsed = z.object({
    projectId: z.string().uuid(), statusId: z.string().uuid(), name: z.string().trim().min(1).max(40),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/), category: z.enum(["not_started", "active", "completed", "cancelled"]),
  }).safeParse({
    projectId: formData.get("projectId"), statusId: formData.get("statusId"), name: formData.get("name"),
    color: formData.get("color"), category: formData.get("category"),
  });
  if (!parsed.success) redirect("/dashboard?error=invalid_status");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { error } = await supabase.from("project_statuses").update({ name: parsed.data.name, color: parsed.data.color, category: parsed.data.category }).eq("id", parsed.data.statusId).eq("project_id", parsed.data.projectId);
  if (error) redirect(`/projects/${parsed.data.projectId}?error=status_update_failed`);
  revalidatePath(`/projects/${parsed.data.projectId}`);
}

export async function deleteProjectStatus(formData: FormData) {
  const parsed = z.object({ projectId: z.string().uuid(), statusId: z.string().uuid() }).safeParse({
    projectId: formData.get("projectId"), statusId: formData.get("statusId"),
  });
  if (!parsed.success) redirect("/dashboard?error=invalid_status");
  const supabase = await createClient();
  const { count } = await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("project_id", parsed.data.projectId).eq("status_id", parsed.data.statusId);
  if (count) redirect(`/projects/${parsed.data.projectId}?error=status_in_use`);
  const { error } = await supabase.from("project_statuses").delete().eq("id", parsed.data.statusId).eq("project_id", parsed.data.projectId);
  if (error) redirect(`/projects/${parsed.data.projectId}?error=status_delete_failed`);
  revalidatePath(`/projects/${parsed.data.projectId}`);
  redirect(`/projects/${parsed.data.projectId}`);
}

export async function addProjectMember(formData: FormData) {
  const parsed = z.object({
    projectId: z.string().uuid(), userId: z.string().uuid(), role: z.enum(["manager", "member", "viewer"]),
  }).safeParse({ projectId: formData.get("projectId"), userId: formData.get("userId"), role: formData.get("role") });
  if (!parsed.success) redirect("/dashboard?error=invalid_project_member");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: project } = await supabase.from("projects").select("workspace_id").eq("id", parsed.data.projectId).maybeSingle();
  if (!project) redirect("/dashboard?error=project_not_found");
  const { data: workspace } = await supabase.from("workspaces").select("organization_id").eq("id", project.workspace_id).maybeSingle();
  if (!workspace) redirect("/dashboard?error=workspace_not_found");
  const { data: member } = await supabase.from("organization_members").select("user_id").eq("organization_id", workspace.organization_id).eq("user_id", parsed.data.userId).eq("status", "active").maybeSingle();
  if (!member) redirect(`/projects/${parsed.data.projectId}?error=member_must_belong_to_organization`);
  const { error } = await supabase.from("project_members").upsert({ project_id: parsed.data.projectId, user_id: parsed.data.userId, role: parsed.data.role }, { onConflict: "project_id,user_id" });
  if (error) redirect(`/projects/${parsed.data.projectId}?error=member_update_failed`);
  revalidatePath(`/projects/${parsed.data.projectId}`);
  redirect(`/projects/${parsed.data.projectId}`);
}

export async function updateProjectMemberRole(formData: FormData) {
  const parsed = z.object({
    projectId: z.string().uuid(),
    userId: z.string().uuid(),
    role: z.enum(["manager", "member", "viewer"]),
  }).safeParse({
    projectId: formData.get("projectId"),
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) redirect("/dashboard?error=invalid_project_member");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: canManage } = await supabase.rpc("can_manage_project", { target_project: parsed.data.projectId });
  if (!canManage) redirect(`/projects/${parsed.data.projectId}?error=member_forbidden`);
  const { error } = await supabase.from("project_members").update({ role: parsed.data.role }).eq("project_id", parsed.data.projectId).eq("user_id", parsed.data.userId);
  if (error) redirect(`/projects/${parsed.data.projectId}?error=member_update_failed`);
  revalidatePath(`/projects/${parsed.data.projectId}`);
  redirect(`/projects/${parsed.data.projectId}`);
}

export async function removeProjectMember(formData: FormData) {
  const parsed = z.object({ projectId: z.string().uuid(), userId: z.string().uuid() }).safeParse({ projectId: formData.get("projectId"), userId: formData.get("userId") });
  if (!parsed.success) redirect("/dashboard?error=invalid_project_member");
  const supabase = await createClient();
  const { error } = await supabase.from("project_members").delete().eq("project_id", parsed.data.projectId).eq("user_id", parsed.data.userId);
  if (error) redirect(`/projects/${parsed.data.projectId}?error=member_remove_failed`);
  revalidatePath(`/projects/${parsed.data.projectId}`);
}

export async function createCustomField(formData: FormData) {
  const parsed = z.object({
    projectId: z.string().uuid(), name: z.string().trim().min(1).max(80),
    fieldType: z.enum(["text", "long_text", "number", "currency", "date", "datetime", "dropdown", "multi_select", "checkbox", "email", "url", "user", "rating", "formula", "progress", "duration"]),
    options: z.string().max(1000).optional(),
    required: z.boolean(),
  }).safeParse({ projectId: formData.get("projectId"), name: formData.get("name"), fieldType: formData.get("fieldType"), options: formData.get("options") ?? "", required: formData.get("required") === "on" });
  if (!parsed.success) redirect("/dashboard?error=invalid_custom_field");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const options = (parsed.data.options ?? "").split(",").map((option) => option.trim()).filter(Boolean).slice(0, 50);
  if (["dropdown", "multi_select"].includes(parsed.data.fieldType) && !options.length) redirect(`/projects/${parsed.data.projectId}?error=custom_field_options_required`);
  const { error } = await supabase.from("custom_field_definitions").insert({
    project_id: parsed.data.projectId, name: parsed.data.name, field_type: parsed.data.fieldType,
    options, required: parsed.data.required, created_by: user.id,
  });
  if (error) redirect(`/projects/${parsed.data.projectId}?error=custom_field_create_failed`);
  revalidatePath(`/projects/${parsed.data.projectId}`);
  redirect(`/projects/${parsed.data.projectId}`);
}

export async function createCustomFieldFromComposer(formData: FormData) {
  const parsed = z.object({
    projectId: z.string().uuid(),
    name: z.string().trim().min(1).max(80),
    fieldType: z.enum(["text", "long_text", "number", "currency", "date", "datetime", "dropdown", "multi_select", "checkbox", "email", "url", "user", "rating", "formula", "progress", "duration"]),
    options: z.string().max(1000).optional(),
    required: z.boolean(),
  }).safeParse({
    projectId: formData.get("projectId"),
    name: formData.get("name"),
    fieldType: formData.get("fieldType"),
    options: formData.get("options") ?? "",
    required: formData.get("required") === "on",
  });
  if (!parsed.success) return { ok: false as const, message: "Enter a field name and choose a valid field type." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, message: "Sign in before creating a field." };
  const { data: canManage } = await supabase.rpc("can_manage_project", { target_project: parsed.data.projectId });
  if (!canManage) return { ok: false as const, message: "Only project managers can create custom fields." };

  const options = (parsed.data.options ?? "").split(",").map((option) => option.trim()).filter(Boolean).slice(0, 50);
  if (["dropdown", "multi_select"].includes(parsed.data.fieldType) && !options.length) {
    return { ok: false as const, message: "Add at least one option for this field type using +." };
  }

  const { error } = await supabase.from("custom_field_definitions").insert({
    project_id: parsed.data.projectId,
    name: parsed.data.name,
    field_type: parsed.data.fieldType,
    options,
    required: parsed.data.required,
    created_by: user.id,
  });
  if (error) return { ok: false as const, message: "Could not create that field. Check for a duplicate name or your project permissions." };

  revalidatePath(`/projects/${parsed.data.projectId}`);
  return { ok: true as const, message: `“${parsed.data.name}” was added to this project.` };
}

export async function saveTaskCustomField(formData: FormData) {
  const parsed = z.object({ projectId: z.string().uuid(), taskId: z.string().uuid(), fieldId: z.string().uuid(), value: z.string().max(10000) }).safeParse({
    projectId: formData.get("projectId"), taskId: formData.get("taskId"), fieldId: formData.get("fieldId"), value: formData.get("value") ?? "",
  });
  if (!parsed.success) redirect("/dashboard?error=invalid_custom_field_value");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: field } = await supabase.from("custom_field_definitions").select("field_type, options, required").eq("id", parsed.data.fieldId).eq("project_id", parsed.data.projectId).maybeSingle();
  if (!field) redirect(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}?error=field_not_found`);
  if (field.field_type === "formula") redirect(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}?error=formula_read_only`);
  const raw = parsed.data.value;
  let value: string | number | boolean | string[] | null = raw === "" ? null : raw;
  if (field.required && (raw === "" || raw === "false")) redirect(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}?error=custom_field_required`);
  if (["number", "currency", "rating", "progress", "duration"].includes(field.field_type) && raw !== "") {
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) redirect(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}?error=invalid_custom_field_value`);
    value = numeric;
  } else if (field.field_type === "checkbox") value = raw === "true";
  else if (field.field_type === "multi_select") {
    value = raw ? raw.split(",").map((item) => item.trim()).filter(Boolean) : [];
  } else if (field.field_type === "dropdown" && raw !== "") {
    const values = raw.split(",").map((s) => s.trim()).filter(Boolean);
    value = values.length > 1 ? values : raw;
  } else if (field.field_type === "email" && raw !== "") {
    const emails = raw.split(/[\s,;]+/).filter(Boolean);
    const allValid = emails.every((em) => z.string().email().safeParse(em).success);
    if (!allValid && emails.length > 0) redirect(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}?error=invalid_custom_field_value`);
    value = emails.length > 1 ? emails.join(", ") : raw;
  } else if (field.field_type === "url" && raw !== "") {
    const urls = raw.split(/[\s,;]+/).filter(Boolean);
    const allValid = urls.every((u) => {
      const clean = u.trim();
      const target = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
      return z.string().url().safeParse(target).success;
    });
    if (!allValid && urls.length > 0) redirect(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}?error=invalid_custom_field_value`);
    value = urls.length > 1 ? urls.join(", ") : raw;
  } else if (field.field_type === "date" && raw !== "") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) redirect(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}?error=invalid_custom_field_value`);
  } else if (field.field_type === "user" && raw !== "") {
    const { data: task } = await supabase.from("tasks").select("project_id, projects(workspace_id, workspaces(organization_id))").eq("id", parsed.data.taskId).maybeSingle();
    const relation = task?.projects;
    const project = Array.isArray(relation) ? relation[0] : relation;
    const workspaceRelation = project?.workspaces;
    const workspace = Array.isArray(workspaceRelation) ? workspaceRelation[0] : workspaceRelation;
    if (!workspace?.organization_id) redirect(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}?error=invalid_custom_field_value`);
    const { data: member } = await supabase.from("organization_members").select("user_id").eq("organization_id", workspace.organization_id).eq("user_id", raw).eq("status", "active").maybeSingle();
    if (!member) redirect(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}?error=invalid_custom_field_value`);
  }
  const { error } = await supabase.from("task_custom_field_values").upsert({
    project_id: parsed.data.projectId, task_id: parsed.data.taskId, field_id: parsed.data.fieldId,
    value, updated_by: user.id,
  }, { onConflict: "task_id,field_id" });
  if (error) redirect(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}?error=custom_field_save_failed`);
  revalidatePath(`/projects/${parsed.data.projectId}`);
  revalidatePath(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}`);
}

export async function createTaskSubtask(formData: FormData) {
  const parsed = z.object({ projectId: z.string().uuid(), parentTaskId: z.string().uuid(), title: z.string().trim().min(1).max(240) }).safeParse({
    projectId: formData.get("projectId"), parentTaskId: formData.get("parentTaskId"), title: formData.get("title"),
  });
  if (!parsed.success) redirect("/dashboard?error=invalid_subtask");
  const rawAssigneeIds = formData.getAll("assigneeIds");
  const assigneeIds = rawAssigneeIds
    .map((id) => z.string().uuid().safeParse(id))
    .filter((r) => r.success)
    .map((r) => (r as { success: true; data: string }).data);
  const uniqueAssigneeIds = [...new Set(assigneeIds)].slice(0, 50);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: parent } = await supabase.from("tasks").select("status_id").eq("id", parsed.data.parentTaskId).eq("project_id", parsed.data.projectId).maybeSingle();
  if (!parent) redirect(`/projects/${parsed.data.projectId}?error=task_not_found`);
  const { data: newSubtask, error } = await supabase.from("tasks").insert({
    project_id: parsed.data.projectId,
    parent_task_id: parsed.data.parentTaskId,
    status_id: parent.status_id,
    title: parsed.data.title,
    created_by: user.id,
    primary_assignee_id: uniqueAssigneeIds[0] ?? null,
    secondary_assignee_id: uniqueAssigneeIds[1] ?? null,
  }).select("id").single();
  if (error || !newSubtask) redirect(`/projects/${parsed.data.projectId}/tasks/${parsed.data.parentTaskId}?error=subtask_failed`);

  if (uniqueAssigneeIds.length > 0) {
    try {
      await supabase.from("task_assignees").insert(
        uniqueAssigneeIds.map((uid) => ({
          project_id: parsed.data.projectId,
          task_id: newSubtask.id,
          user_id: uid,
          assigned_by: user.id,
        }))
      );
    } catch (syncErr) {
      console.warn("task_assignees sync in createTaskSubtask:", syncErr);
    }

    await notifyAssigneesOnTask({
      projectId: parsed.data.projectId,
      taskId: newSubtask.id,
      assigneeIds: uniqueAssigneeIds,
      actorId: user.id,
    });
  }

  await recordSubtaskAddedActivity({
    projectId: parsed.data.projectId,
    parentTaskId: parsed.data.parentTaskId,
    subtaskId: newSubtask.id,
    actorId: user.id,
    title: parsed.data.title,
  });

  revalidatePath(`/projects/${parsed.data.projectId}`);
  revalidatePath(`/projects/${parsed.data.projectId}/tasks/${parsed.data.parentTaskId}`);
  revalidatePath("/dashboard");
  revalidatePath("/my-dashboard");
}

export async function createTaskDependency(formData: FormData) {
  const parsed = z.object({
    projectId: z.string().uuid(), taskId: z.string().uuid(), linkedTaskId: z.string().uuid(),
    relation: z.enum(["blocks", "blocked_by", "related", "duplicate"]),
  }).safeParse({
    projectId: formData.get("projectId"), taskId: formData.get("taskId"), linkedTaskId: formData.get("linkedTaskId"), relation: formData.get("relation"),
  });
  if (!parsed.success || parsed.data.taskId === parsed.data.linkedTaskId) redirect("/dashboard?error=invalid_dependency");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { error } = await supabase.from("task_dependencies").upsert({
    project_id: parsed.data.projectId, task_id: parsed.data.taskId, linked_task_id: parsed.data.linkedTaskId,
    relation: parsed.data.relation, created_by: user.id,
  }, { onConflict: "task_id,linked_task_id,relation" });
  if (error) redirect(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}?error=dependency_failed`);
  revalidatePath(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}`);
}

export async function removeTaskDependency(formData: FormData) {
  const parsed = z.object({ projectId: z.string().uuid(), taskId: z.string().uuid(), linkedTaskId: z.string().uuid(), relation: z.enum(["blocks", "blocked_by", "related", "duplicate"]) }).safeParse({
    projectId: formData.get("projectId"), taskId: formData.get("taskId"), linkedTaskId: formData.get("linkedTaskId"), relation: formData.get("relation"),
  });
  if (!parsed.success) redirect("/dashboard?error=invalid_dependency");
  const supabase = await createClient();
  const { error } = await supabase.from("task_dependencies").delete().eq("project_id", parsed.data.projectId).eq("task_id", parsed.data.taskId).eq("linked_task_id", parsed.data.linkedTaskId).eq("relation", parsed.data.relation);
  if (error) redirect(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}?error=dependency_failed`);
  revalidatePath(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}`);
}

export async function createTaskChecklist(formData: FormData) {
  const parsed = z.object({ projectId: z.string().uuid(), taskId: z.string().uuid(), title: z.string().trim().min(1).max(100) }).safeParse({
    projectId: formData.get("projectId"), taskId: formData.get("taskId"), title: formData.get("title") || "Checklist",
  });
  if (!parsed.success) redirect("/dashboard?error=invalid_checklist");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { error } = await supabase.from("task_checklists").insert({ project_id: parsed.data.projectId, task_id: parsed.data.taskId, title: parsed.data.title, created_by: user.id });
  if (error) redirect(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}?error=checklist_failed`);
  revalidatePath(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}`);
}

export async function createChecklistItem(formData: FormData) {
  const parsed = z.object({ projectId: z.string().uuid(), taskId: z.string().uuid(), checklistId: z.string().uuid(), title: z.string().trim().min(1).max(300) }).safeParse({
    projectId: formData.get("projectId"), taskId: formData.get("taskId"), checklistId: formData.get("checklistId"), title: formData.get("title"),
  });
  if (!parsed.success) redirect("/dashboard?error=invalid_checklist_item");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { error } = await supabase.from("checklist_items").insert({
    project_id: parsed.data.projectId, task_id: parsed.data.taskId, checklist_id: parsed.data.checklistId,
    title: parsed.data.title, created_by: user.id,
  });
  if (error) redirect(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}?error=checklist_failed`);
  revalidatePath(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}`);
}

export async function toggleChecklistItem(formData: FormData) {
  const parsed = z.object({ projectId: z.string().uuid(), taskId: z.string().uuid(), itemId: z.string().uuid(), complete: z.enum(["true", "false"]) }).safeParse({
    projectId: formData.get("projectId"), taskId: formData.get("taskId"), itemId: formData.get("itemId"), complete: formData.get("complete"),
  });
  if (!parsed.success) redirect("/dashboard?error=invalid_checklist_item");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const isComplete = parsed.data.complete === "true";
  const { error } = await supabase.from("checklist_items").update({ is_complete: isComplete, completed_by: isComplete ? user.id : null, completed_at: isComplete ? new Date().toISOString() : null }).eq("id", parsed.data.itemId).eq("project_id", parsed.data.projectId).eq("task_id", parsed.data.taskId);
  if (error) redirect(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}?error=checklist_failed`);
  revalidatePath(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}`);
}

export async function renameTaskChecklist(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const parsed = z.object({
    projectId: z.string().uuid(),
    taskId: z.string().uuid(),
    checklistId: z.string().uuid(),
    title: z.string().trim().min(1).max(100),
  }).safeParse({
    projectId: formData.get("projectId"),
    taskId: formData.get("taskId"),
    checklistId: formData.get("checklistId"),
    title: formData.get("title"),
  });
  if (!parsed.success) return { ok: false, error: "Enter a valid checklist name (1-100 characters)." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to update checklists." };

  const { error } = await supabase
    .from("task_checklists")
    .update({ title: parsed.data.title })
    .eq("id", parsed.data.checklistId)
    .eq("project_id", parsed.data.projectId)
    .eq("task_id", parsed.data.taskId);

  if (error) return { ok: false, error: "Could not rename checklist." };
  revalidatePath(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}`);
  return { ok: true };
}

export async function deleteTaskChecklist(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const parsed = z.object({
    projectId: z.string().uuid(),
    taskId: z.string().uuid(),
    checklistId: z.string().uuid(),
  }).safeParse({
    projectId: formData.get("projectId"),
    taskId: formData.get("taskId"),
    checklistId: formData.get("checklistId"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid checklist." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to delete checklists." };

  const { error } = await supabase
    .from("task_checklists")
    .delete()
    .eq("id", parsed.data.checklistId)
    .eq("project_id", parsed.data.projectId)
    .eq("task_id", parsed.data.taskId);

  if (error) return { ok: false, error: "Could not delete checklist." };
  revalidatePath(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}`);
  return { ok: true };
}

export async function updateChecklistItemTitle(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const parsed = z.object({
    projectId: z.string().uuid(),
    taskId: z.string().uuid(),
    itemId: z.string().uuid(),
    title: z.string().trim().min(1).max(300),
  }).safeParse({
    projectId: formData.get("projectId"),
    taskId: formData.get("taskId"),
    itemId: formData.get("itemId"),
    title: formData.get("title"),
  });
  if (!parsed.success) return { ok: false, error: "Enter a valid checklist item title." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to edit checklist items." };

  const { error } = await supabase
    .from("checklist_items")
    .update({ title: parsed.data.title })
    .eq("id", parsed.data.itemId)
    .eq("project_id", parsed.data.projectId)
    .eq("task_id", parsed.data.taskId);

  if (error) return { ok: false, error: "Could not update checklist item." };
  revalidatePath(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}`);
  return { ok: true };
}

export async function deleteChecklistItem(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const parsed = z.object({
    projectId: z.string().uuid(),
    taskId: z.string().uuid(),
    itemId: z.string().uuid(),
  }).safeParse({
    projectId: formData.get("projectId"),
    taskId: formData.get("taskId"),
    itemId: formData.get("itemId"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid checklist item." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to delete checklist items." };

  const { error } = await supabase
    .from("checklist_items")
    .delete()
    .eq("id", parsed.data.itemId)
    .eq("project_id", parsed.data.projectId)
    .eq("task_id", parsed.data.taskId);

  if (error) return { ok: false, error: "Could not delete checklist item." };
  revalidatePath(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}`);
  return { ok: true };
}

export async function startTaskTimer(formData: FormData) {
  const parsed = z.object({
    projectId: z.string().uuid(),
    taskId: z.string().uuid(),
    billable: z.enum(["true", "false"]).optional(),
  }).safeParse({
    projectId: formData.get("projectId"),
    taskId: formData.get("taskId"),
    billable: formData.get("billable") === "false" ? "false" : "true",
  });
  if (!parsed.success) redirect("/dashboard?error=invalid_timer");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: running } = await supabase.from("time_entries").select("id").eq("user_id", user.id).is("ended_at", null).maybeSingle();
  if (running) redirect(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}?error=timer_already_running`);
  const isBillable = parsed.data.billable !== "false";
  const { error } = await supabase.from("time_entries").insert({
    project_id: parsed.data.projectId,
    task_id: parsed.data.taskId,
    user_id: user.id,
    started_at: new Date().toISOString(),
    billable: isBillable,
  });
  if (error) redirect(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}?error=timer_failed`);
  revalidatePath(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}`);
  revalidatePath(`/projects/${parsed.data.projectId}`);
}

export async function stopTaskTimer(formData: FormData) {
  const parsed = z.object({ projectId: z.string().uuid(), taskId: z.string().uuid(), entryId: z.string().uuid() }).safeParse({ projectId: formData.get("projectId"), taskId: formData.get("taskId"), entryId: formData.get("entryId") });
  if (!parsed.success) redirect("/dashboard?error=invalid_timer");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const endedAt = new Date();
  const { data: entry } = await supabase.from("time_entries").select("started_at").eq("id", parsed.data.entryId).eq("task_id", parsed.data.taskId).eq("user_id", user.id).is("ended_at", null).maybeSingle();
  if (!entry) redirect(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}?error=timer_not_found`);
  const minutes = elapsedMinutes(entry.started_at, endedAt);
  const { error } = await supabase.from("time_entries").update({ ended_at: endedAt.toISOString(), duration_minutes: minutes }).eq("id", parsed.data.entryId).eq("user_id", user.id);
  if (error) redirect(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}?error=timer_failed`);
  await checkAndNotifyHoursExhausting({
    projectId: parsed.data.projectId,
    taskId: parsed.data.taskId,
  });
  revalidatePath(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}`);
  revalidatePath(`/projects/${parsed.data.projectId}/time`);
  revalidatePath(`/projects/${parsed.data.projectId}`);
}

export async function updateTaskProgress(formData: FormData) {
  const parsed = z.object({
    projectId: z.string().uuid(),
    taskId: z.string().uuid(),
    progress: z.coerce.number().int().min(0).max(100),
  }).safeParse({
    projectId: formData.get("projectId"),
    taskId: formData.get("taskId"),
    progress: formData.get("progress"),
  });
  if (!parsed.success) return { ok: false };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase.from("tasks").update({ progress: parsed.data.progress }).eq("id", parsed.data.taskId).eq("project_id", parsed.data.projectId);
  if (error) return { ok: false };
  revalidatePath(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}`);
  revalidatePath(`/projects/${parsed.data.projectId}`);
  return { ok: true, progress: parsed.data.progress };
}

export async function addManualTimeEntry(formData: FormData) {
  const parsed = z.object({ projectId: z.string().uuid(), taskId: z.string().uuid(), minutes: z.coerce.number().int().min(1).max(100000), description: z.string().trim().max(2000).optional(), billable: z.enum(["true", "false"]).optional() }).safeParse({
    projectId: formData.get("projectId"), taskId: formData.get("taskId"), minutes: formData.get("minutes"), description: formData.get("description") || undefined, billable: formData.get("billable") === "false" ? "false" : "true",
  });
  if (!parsed.success) redirect("/dashboard?error=invalid_time_entry");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const ended = new Date();
  const started = new Date(ended.getTime() - parsed.data.minutes * 60000);
  const { error } = await supabase.from("time_entries").insert({ project_id: parsed.data.projectId, task_id: parsed.data.taskId, user_id: user.id, started_at: started.toISOString(), ended_at: ended.toISOString(), duration_minutes: parsed.data.minutes, description: parsed.data.description ?? "", billable: parsed.data.billable === "true" });
  if (error) redirect(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}?error=time_entry_failed`);
  await checkAndNotifyHoursExhausting({
    projectId: parsed.data.projectId,
    taskId: parsed.data.taskId,
  });
  revalidatePath(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}`);
  revalidatePath(`/projects/${parsed.data.projectId}/time`);
  revalidatePath(`/projects/${parsed.data.projectId}`);
}

export async function markNotificationsRead() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  await supabase.rpc("mark_my_notifications_read");
  revalidatePath("/inbox");
}

export async function createProjectDocument(formData: FormData) {
  const parsed = z.object({ projectId: z.string().uuid(), title: z.string().trim().min(1).max(200) }).safeParse({ projectId: formData.get("projectId"), title: formData.get("title") });
  if (!parsed.success) redirect("/dashboard?error=invalid_document");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: document, error } = await supabase.from("project_documents").insert({ project_id: parsed.data.projectId, title: parsed.data.title, created_by: user.id, updated_by: user.id }).select("id").single();
  if (error || !document) redirect(`/projects/${parsed.data.projectId}/documents?error=document_create_failed`);
  revalidatePath(`/projects/${parsed.data.projectId}/documents`);
  redirect(`/projects/${parsed.data.projectId}/documents/${document.id}`);
}

export async function saveProjectDocument(formData: FormData) {
  const parsed = z.object({ projectId: z.string().uuid(), documentId: z.string().uuid(), title: z.string().trim().min(1).max(200), body: z.string().max(500000) }).safeParse({
    projectId: formData.get("projectId"), documentId: formData.get("documentId"), title: formData.get("title"), body: formData.get("body"),
  });
  if (!parsed.success) redirect("/dashboard?error=invalid_document");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { error } = await supabase.from("project_documents").update({ title: parsed.data.title, body_markdown: parsed.data.body, updated_by: user.id }).eq("id", parsed.data.documentId).eq("project_id", parsed.data.projectId);
  if (error) redirect(`/projects/${parsed.data.projectId}/documents/${parsed.data.documentId}?error=document_save_failed`);
  revalidatePath(`/projects/${parsed.data.projectId}/documents`);
  redirect(`/projects/${parsed.data.projectId}/documents/${parsed.data.documentId}?saved=1`);
}

export async function quickCreateProjectDocument(formData: FormData) {
  const parsed = z
    .object({
      projectId: z.string().uuid(),
      title: z.string().trim().min(1).max(200),
      body: z.string().max(500000).optional(),
    })
    .safeParse({
      projectId: formData.get("projectId"),
      title: formData.get("title"),
      body: formData.get("body") ? String(formData.get("body")) : undefined,
    });

  if (!parsed.success) return { ok: false, error: "invalid_document" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const { data: document, error } = await supabase
    .from("project_documents")
    .insert({
      project_id: parsed.data.projectId,
      title: parsed.data.title,
      body_markdown: parsed.data.body ?? "",
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id, title, updated_at")
    .single();

  if (error || !document) return { ok: false, error: error?.message || "create_failed" };
  revalidatePath(`/projects/${parsed.data.projectId}/documents`);
  return { ok: true, document };
}

export async function quickSaveProjectDocument(formData: FormData) {
  const parsed = z
    .object({
      projectId: z.string().uuid(),
      documentId: z.string().uuid(),
      title: z.string().trim().min(1).max(200),
      body: z.string().max(500000),
    })
    .safeParse({
      projectId: formData.get("projectId"),
      documentId: formData.get("documentId"),
      title: formData.get("title"),
      body: formData.get("body"),
    });

  if (!parsed.success) return { ok: false, error: "invalid_document" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const { error } = await supabase
    .from("project_documents")
    .update({
      title: parsed.data.title,
      body_markdown: parsed.data.body,
      updated_by: user.id,
    })
    .eq("id", parsed.data.documentId)
    .eq("project_id", parsed.data.projectId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${parsed.data.projectId}/documents`);
  return { ok: true };
}

export async function submitProjectTimesheet(formData: FormData) {
  const parsed = z.object({ projectId: z.string().uuid(), weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).safeParse({ projectId: formData.get("projectId"), weekStart: formData.get("weekStart") });
  if (!parsed.success) redirect("/dashboard?error=invalid_timesheet");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { error } = await supabase.rpc("submit_project_timesheet", { target_project: parsed.data.projectId, target_week: parsed.data.weekStart });
  if (error) redirect(`/projects/${parsed.data.projectId}/timesheets?week=${parsed.data.weekStart}&error=submit_failed`);
  revalidatePath(`/projects/${parsed.data.projectId}/timesheets`);
}

export async function reviewProjectTimesheet(formData: FormData) {
  const parsed = z.object({ projectId: z.string().uuid(), timesheetId: z.string().uuid(), decision: z.enum(["approved", "rejected"]), note: z.string().trim().max(2000).optional() }).safeParse({
    projectId: formData.get("projectId"), timesheetId: formData.get("timesheetId"), decision: formData.get("decision"), note: formData.get("note") || undefined,
  });
  if (!parsed.success) redirect("/dashboard?error=invalid_timesheet_review");
  if (parsed.data.decision === "rejected" && !parsed.data.note?.trim()) redirect(`/projects/${parsed.data.projectId}/timesheets?error=review_note_required`);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { error } = await supabase.rpc("review_project_timesheet", { target_timesheet: parsed.data.timesheetId, decision: parsed.data.decision, note: parsed.data.note ?? "" });
  if (error) redirect(`/projects/${parsed.data.projectId}/timesheets?error=review_failed`);
  revalidatePath(`/projects/${parsed.data.projectId}/timesheets`);
}

export async function createLeaveRequest(formData: FormData) {
  const parsed = z.object({ organizationId: z.string().uuid(), leaveType: z.enum(["vacation", "sick", "personal", "other"]), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), note: z.string().trim().max(2000).optional() }).safeParse({
    organizationId: formData.get("organizationId"), leaveType: formData.get("leaveType"), startDate: formData.get("startDate"), endDate: formData.get("endDate"), note: formData.get("note") || undefined,
  });
  if (!parsed.success || parsed.data.endDate < parsed.data.startDate) redirect("/dashboard?error=invalid_leave_request");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { error } = await supabase.from("leave_requests").insert({ organization_id: parsed.data.organizationId, user_id: user.id, leave_type: parsed.data.leaveType, start_date: parsed.data.startDate, end_date: parsed.data.endDate, request_note: parsed.data.note ?? "" });
  if (error) redirect(`/organizations/${parsed.data.organizationId}/calendar?error=leave_request_failed`);
  revalidatePath(`/organizations/${parsed.data.organizationId}/calendar`);
}

export async function reviewLeaveRequest(formData: FormData) {
  const parsed = z.object({ organizationId: z.string().uuid(), requestId: z.string().uuid(), decision: z.enum(["approved", "rejected"]), note: z.string().trim().max(2000).optional() }).safeParse({
    organizationId: formData.get("organizationId"), requestId: formData.get("requestId"), decision: formData.get("decision"), note: formData.get("note") || undefined,
  });
  if (!parsed.success) redirect("/dashboard?error=invalid_leave_review");
  if (parsed.data.decision === "rejected" && !parsed.data.note?.trim()) redirect(`/organizations/${parsed.data.organizationId}/calendar?error=review_note_required`);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { error } = await supabase.rpc("review_leave_request", { target_request: parsed.data.requestId, decision: parsed.data.decision, note: parsed.data.note ?? "" });
  if (error) redirect(`/organizations/${parsed.data.organizationId}/calendar?error=leave_review_failed`);
  revalidatePath(`/organizations/${parsed.data.organizationId}/calendar`);
}

export async function createOrganizationHoliday(formData: FormData) {
  const parsed = z.object({ organizationId: z.string().uuid(), name: z.string().trim().min(1).max(120), holidayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), location: z.string().trim().max(120).optional() }).safeParse({
    organizationId: formData.get("organizationId"), name: formData.get("name"), holidayDate: formData.get("holidayDate"), location: formData.get("location") || undefined,
  });
  if (!parsed.success) redirect("/dashboard?error=invalid_holiday");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { error } = await supabase.from("organization_holidays").insert({ organization_id: parsed.data.organizationId, name: parsed.data.name, holiday_date: parsed.data.holidayDate, location: parsed.data.location ?? "", created_by: user.id });
  if (error) redirect(`/organizations/${parsed.data.organizationId}/calendar?error=holiday_create_failed`);
  revalidatePath(`/organizations/${parsed.data.organizationId}/calendar`);
}

export async function autoImportCountryHolidays(formData: FormData): Promise<{
  ok: boolean;
  addedCount: number;
  countryName: string;
  error?: string;
}> {
  const parsed = z
    .object({
      organizationId: z.string().uuid(),
      countryCode: z.string().trim().min(2).max(4),
      year: z.coerce.number().int().min(2020).max(2035),
    })
    .safeParse({
      organizationId: formData.get("organizationId"),
      countryCode: formData.get("countryCode"),
      year: formData.get("year"),
    });

  if (!parsed.success) {
    return {
      ok: false,
      addedCount: 0,
      countryName: "",
      error: "Select a valid country and year.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      addedCount: 0,
      countryName: "",
      error: "You must be signed in.",
    };
  }

  const { data: canAdmin } = await supabase.rpc("has_org_role", {
    target_org: parsed.data.organizationId,
    allowed_roles: ["owner", "admin"],
  });
  if (canAdmin !== true) {
    return {
      ok: false,
      addedCount: 0,
      countryName: "",
      error: "Only organization owners or admins can import holidays.",
    };
  }

  const code = parsed.data.countryCode.toUpperCase();
  const countryName = getCountryNameByCode(code);

  try {
    await supabase
      .from("organizations")
      .update({ country_code: code })
      .eq("id", parsed.data.organizationId);
  } catch {
    // Graceful if migration adding organizations.country_code is pending.
  }

  const holidays = await fetchOrGenerateCountryPublicHolidays(
    code,
    parsed.data.year
  );
  if (holidays.length === 0) {
    return {
      ok: false,
      addedCount: 0,
      countryName,
      error: `No public holidays found for ${countryName} (${parsed.data.year}).`,
    };
  }

  const startDate = `${parsed.data.year}-01-01`;
  const endDate = `${parsed.data.year}-12-31`;
  const { data: existingRows } = await supabase
    .from("organization_holidays")
    .select("name, holiday_date")
    .eq("organization_id", parsed.data.organizationId)
    .gte("holiday_date", startDate)
    .lte("holiday_date", endDate);

  const existingKeys = new Set(
    (existingRows ?? []).map(
      (r) => `${r.holiday_date}::${r.name.trim().toLowerCase()}`
    )
  );

  const toInsert = holidays
    .filter((h) => !existingKeys.has(`${h.date}::${h.name.trim().toLowerCase()}`))
    .map((h) => ({
      organization_id: parsed.data.organizationId,
      name: h.name,
      holiday_date: h.date,
      location: h.location || countryName,
      created_by: user.id,
    }));

  if (toInsert.length > 0) {
    const { error } = await supabase
      .from("organization_holidays")
      .insert(toInsert);
    if (error) {
      return {
        ok: false,
        addedCount: 0,
        countryName,
        error: error.message,
      };
    }
  }

  revalidatePath(`/organizations/${parsed.data.organizationId}/calendar`);
  return {
    ok: true,
    addedCount: toInsert.length,
    countryName,
  };
}

export async function deleteOrganizationHoliday(formData: FormData) {
  const parsed = z
    .object({
      organizationId: z.string().uuid(),
      holidayId: z.string().uuid(),
    })
    .safeParse({
      organizationId: formData.get("organizationId"),
      holidayId: formData.get("holidayId"),
    });
  if (!parsed.success) redirect("/dashboard?error=invalid_holiday");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { error } = await supabase
    .from("organization_holidays")
    .delete()
    .eq("id", parsed.data.holidayId)
    .eq("organization_id", parsed.data.organizationId);

  if (error) {
    redirect(`/organizations/${parsed.data.organizationId}/calendar?error=holiday_delete_failed`);
  }
  revalidatePath(`/organizations/${parsed.data.organizationId}/calendar`);
}

export async function requestPasswordReset(formData: FormData) {
  const email = z.string().trim().email().safeParse(formData.get("email"));
  if (!email.success) redirect("/reset-password?error=invalid_input");

  let appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  try {
    const headerList = await headers();
    const host = headerList.get("x-forwarded-host") || headerList.get("host");
    if (host) {
      const proto = headerList.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
      appUrl = `${proto}://${host}`;
    }
  } catch {}

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${appUrl}/auth/callback?next=/auth/reset-password&type=recovery`,
  });

  if (error) {
    console.error("[ResetPassword] Supabase reset error:", error);
    redirect("/reset-password?error=reset_send_failed");
  }

  redirect("/reset-password?message=reset_sent");
}

export async function quickCreateSubtask(formData: FormData) {
  const parsed = z
    .object({
      projectId: z.string().uuid(),
      parentTaskId: z.string().uuid(),
      title: z.string().trim().min(1).max(240),
    })
    .safeParse({
      projectId: formData.get("projectId"),
      parentTaskId: formData.get("parentTaskId"),
      title: formData.get("title"),
    });

  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const rawAssigneeIds = formData.getAll("assigneeIds");
  const assigneeIds = rawAssigneeIds
    .map((id) => z.string().uuid().safeParse(id))
    .filter((r) => r.success)
    .map((r) => (r as { success: true; data: string }).data);
  const uniqueAssigneeIds = [...new Set(assigneeIds)].slice(0, 50);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const { data: parent } = await supabase
    .from("tasks")
    .select("status_id")
    .eq("id", parsed.data.parentTaskId)
    .eq("project_id", parsed.data.projectId)
    .maybeSingle();

  if (!parent) return { ok: false, error: "task_not_found" };

  const { data: subtask, error } = await supabase
    .from("tasks")
    .insert({
      project_id: parsed.data.projectId,
      parent_task_id: parsed.data.parentTaskId,
      status_id: parent.status_id,
      title: parsed.data.title,
      created_by: user.id,
      primary_assignee_id: uniqueAssigneeIds[0] ?? null,
      secondary_assignee_id: uniqueAssigneeIds[1] ?? null,
    })
    .select("id, title, generated_key")
    .single();

  if (error || !subtask) return { ok: false, error: "subtask_failed" };

  if (uniqueAssigneeIds.length > 0) {
    try {
      await supabase.from("task_assignees").insert(
        uniqueAssigneeIds.map((uid) => ({
          project_id: parsed.data.projectId,
          task_id: subtask.id,
          user_id: uid,
          assigned_by: user.id,
        }))
      );
    } catch (syncErr) {
      console.warn("task_assignees sync in quickCreateSubtask:", syncErr);
    }

    await notifyAssigneesOnTask({
      projectId: parsed.data.projectId,
      taskId: subtask.id,
      assigneeIds: uniqueAssigneeIds,
      actorId: user.id,
    });
  }

  await recordSubtaskAddedActivity({
    projectId: parsed.data.projectId,
    parentTaskId: parsed.data.parentTaskId,
    subtaskId: subtask.id,
    actorId: user.id,
    title: parsed.data.title,
  });

  revalidatePath(`/projects/${parsed.data.projectId}`);
  revalidatePath(`/projects/${parsed.data.projectId}/tasks/${parsed.data.parentTaskId}`);
  revalidatePath("/dashboard");
  revalidatePath("/my-dashboard");
  return { ok: true, subtask };
}

export async function createAndAttachCanvas(formData: FormData) {
  const parsed = z
    .object({
      projectId: z.string().uuid(),
      taskId: z.string().uuid().optional(),
      title: z.string().trim().min(1).max(200),
      type: z.enum(["whiteboard", "flowchart"]),
      data: z.string().max(500000).optional().default("{}"),
    })
    .safeParse({
      projectId: formData.get("projectId"),
      taskId: formData.get("taskId") || undefined,
      title: formData.get("title"),
      type: formData.get("type"),
      data: (formData.get("data") as string) || "{}",
    });

  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const initialContent =
    parsed.data.data && parsed.data.data !== "{}"
      ? parsed.data.data
      : parsed.data.type === "whiteboard"
      ? JSON.stringify({ version: 1, strokes: [], stickyNotes: [], images: [] })
      : JSON.stringify({ nodes: [], edges: [] });

  const payload = JSON.stringify({
    canvasType: parsed.data.type,
    content: initialContent,
  });

  const { data: doc, error: docError } = await supabase
    .from("project_documents")
    .insert({
      project_id: parsed.data.projectId,
      title: parsed.data.title,
      body_markdown: payload,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id, title")
    .single();

  if (docError || !doc) return { ok: false, error: docError?.message || "create_failed" };

  if (parsed.data.taskId) {
    const mimeType =
      parsed.data.type === "whiteboard"
        ? "application/json+whiteboard"
        : "application/json+flowchart";

    await supabase.from("task_attachments").insert({
      project_id: parsed.data.projectId,
      task_id: parsed.data.taskId,
      file_name: doc.title,
      mime_type: mimeType,
      file_size_bytes: payload.length,
      storage_provider: "external_link",
      external_file_id: doc.id,
      external_url: `/projects/${parsed.data.projectId}/documents/${doc.id}`,
      uploaded_by: user.id,
    });
  }

  revalidatePath(`/projects/${parsed.data.projectId}`);
  return { ok: true, documentId: doc.id };
}

export async function saveCanvasData(formData: FormData) {
  const parsed = z
    .object({
      projectId: z.string().uuid(),
      documentId: z.string().uuid(),
      title: z.string().trim().min(1).max(200),
      type: z.enum(["whiteboard", "flowchart"]),
      data: z.string().max(500000).optional().default("{}"),
    })
    .safeParse({
      projectId: formData.get("projectId"),
      documentId: formData.get("documentId"),
      title: formData.get("title"),
      type: formData.get("type"),
      data: (formData.get("data") as string) || "{}",
    });

  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const payload = JSON.stringify({
    canvasType: parsed.data.type,
    content: parsed.data.data,
  });

  const { error } = await supabase
    .from("project_documents")
    .update({
      title: parsed.data.title,
      body_markdown: payload,
      updated_by: user.id,
    })
    .eq("id", parsed.data.documentId)
    .eq("project_id", parsed.data.projectId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${parsed.data.projectId}`);
  return { ok: true };
}

export async function attachExistingDocToTask(formData: FormData) {
  const parsed = z
    .object({
      projectId: z.string().uuid(),
      taskId: z.string().uuid(),
      documentId: z.string().uuid(),
    })
    .safeParse({
      projectId: formData.get("projectId"),
      taskId: formData.get("taskId"),
      documentId: formData.get("documentId"),
    });

  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const { data: doc } = await supabase
    .from("project_documents")
    .select("id, title, body_markdown")
    .eq("id", parsed.data.documentId)
    .eq("project_id", parsed.data.projectId)
    .maybeSingle();

  if (!doc) return { ok: false, error: "document_not_found" };

  let mimeType = "text/markdown";
  try {
    const json = JSON.parse(doc.body_markdown);
    if (json.canvasType === "whiteboard") mimeType = "application/json+whiteboard";
    else if (json.canvasType === "flowchart") mimeType = "application/json+flowchart";
  } catch {}

  const { error } = await supabase.from("task_attachments").insert({
    project_id: parsed.data.projectId,
    task_id: parsed.data.taskId,
    file_name: doc.title,
    mime_type: mimeType,
    file_size_bytes: doc.body_markdown.length,
    storage_provider: "external_link",
    external_file_id: doc.id,
    external_url: `/projects/${parsed.data.projectId}/documents/${doc.id}`,
    uploaded_by: user.id,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${parsed.data.projectId}`);
  return { ok: true };
}

export async function removeTaskAttachment(formData: FormData) {
  const parsed = z
    .object({
      projectId: z.string().uuid(),
      taskId: z.string().uuid(),
      attachmentId: z.string().uuid(),
    })
    .safeParse({
      projectId: formData.get("projectId"),
      taskId: formData.get("taskId"),
      attachmentId: formData.get("attachmentId"),
    });

  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const { error } = await supabase
    .from("task_attachments")
    .delete()
    .eq("id", parsed.data.attachmentId)
    .eq("project_id", parsed.data.projectId)
    .eq("task_id", parsed.data.taskId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${parsed.data.projectId}`);
  revalidatePath(`/projects/${parsed.data.projectId}/tasks/${parsed.data.taskId}`);
  return { ok: true };
}

/* =========================================================================
   Storage Integrations: Local Storage, Google Drive, OneDrive, SharePoint
   ========================================================================= */

export async function setWorkspaceActiveStorageProvider(formData: FormData) {
  const parsed = z
    .object({
      workspaceId: z.string().uuid(),
      provider: z.enum(["local", "google_drive", "onedrive", "sharepoint"]),
    })
    .safeParse({
      workspaceId: formData.get("workspaceId"),
      provider: formData.get("provider"),
    });

  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const { data: canManage } = await supabase.rpc("can_manage_workspace", {
    target_workspace: parsed.data.workspaceId,
  });
  if (!canManage) return { ok: false, error: "forbidden" };

  const { data: ws } = await supabase
    .from("workspaces")
    .select("organization_id")
    .eq("id", parsed.data.workspaceId)
    .single();
  if (!ws) return { ok: false, error: "workspace_not_found" };

  const { error } = await supabase.from("workspace_storage_configs").upsert(
    {
      workspace_id: parsed.data.workspaceId,
      organization_id: ws.organization_id,
      active_provider: parsed.data.provider,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id" }
  );

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/workspaces/${parsed.data.workspaceId}`);
  return { ok: true };
}

export async function saveWorkspaceOneDriveConfig(formData: FormData) {
  const parsed = z
    .object({
      workspaceId: z.string().uuid(),
      accountEmail: z.string().email().optional().or(z.literal("")),
      folderName: z.string().max(120).optional().default("Orbitwork"),
      tenantId: z.string().max(120).optional().or(z.literal("")),
      clientId: z.string().max(120).optional().or(z.literal("")),
      setActive: z.string().optional(),
    })
    .safeParse({
      workspaceId: formData.get("workspaceId"),
      accountEmail: formData.get("accountEmail") || undefined,
      folderName: formData.get("folderName") || "Orbitwork",
      tenantId: formData.get("tenantId") || undefined,
      clientId: formData.get("clientId") || undefined,
      setActive: formData.get("setActive") || undefined,
    });

  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const { data: canManage } = await supabase.rpc("can_manage_workspace", {
    target_workspace: parsed.data.workspaceId,
  });
  if (!canManage) return { ok: false, error: "forbidden" };

  const { data: ws } = await supabase
    .from("workspaces")
    .select("organization_id")
    .eq("id", parsed.data.workspaceId)
    .single();
  if (!ws) return { ok: false, error: "workspace_not_found" };

  const updates: Record<string, unknown> = {
    workspace_id: parsed.data.workspaceId,
    organization_id: ws.organization_id,
    onedrive_connected: true,
    onedrive_account_email: parsed.data.accountEmail || user.email || null,
    onedrive_folder: parsed.data.folderName,
    onedrive_tenant_id: parsed.data.tenantId || null,
    onedrive_client_id: parsed.data.clientId || null,
    onedrive_connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.setActive === "true" || parsed.data.setActive === "on") {
    updates.active_provider = "onedrive";
  }

  const { error } = await supabase.from("workspace_storage_configs").upsert(updates, {
    onConflict: "workspace_id",
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/workspaces/${parsed.data.workspaceId}`);
  return { ok: true };
}

export async function disconnectWorkspaceOneDrive(formData: FormData) {
  const parsed = z
    .object({
      workspaceId: z.string().uuid(),
    })
    .safeParse({
      workspaceId: formData.get("workspaceId"),
    });

  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const { data: canManage } = await supabase.rpc("can_manage_workspace", {
    target_workspace: parsed.data.workspaceId,
  });
  if (!canManage) return { ok: false, error: "forbidden" };

  const { data: existing } = await supabase
    .from("workspace_storage_configs")
    .select("active_provider")
    .eq("workspace_id", parsed.data.workspaceId)
    .maybeSingle();

  const updates: Record<string, unknown> = {
    onedrive_connected: false,
    onedrive_account_email: null,
    onedrive_connected_at: null,
    updated_at: new Date().toISOString(),
  };

  if (existing?.active_provider === "onedrive") {
    updates.active_provider = "local";
  }

  const { error } = await supabase
    .from("workspace_storage_configs")
    .update(updates)
    .eq("workspace_id", parsed.data.workspaceId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/workspaces/${parsed.data.workspaceId}`);
  return { ok: true };
}

export async function saveWorkspaceSharePointConfig(formData: FormData) {
  const parsed = z
    .object({
      workspaceId: z.string().uuid(),
      siteUrl: z.string().url("Must be a valid URL, e.g. https://company.sharepoint.com/sites/team"),
      libraryName: z.string().max(100).optional().default("Documents"),
      folderName: z.string().max(120).optional().default("Orbitwork"),
      accountEmail: z.string().email().optional().or(z.literal("")),
      tenantId: z.string().max(120).optional().or(z.literal("")),
      clientId: z.string().max(120).optional().or(z.literal("")),
      setActive: z.string().optional(),
    })
    .safeParse({
      workspaceId: formData.get("workspaceId"),
      siteUrl: formData.get("siteUrl"),
      libraryName: formData.get("libraryName") || "Documents",
      folderName: formData.get("folderName") || "Orbitwork",
      accountEmail: formData.get("accountEmail") || undefined,
      tenantId: formData.get("tenantId") || undefined,
      clientId: formData.get("clientId") || undefined,
      setActive: formData.get("setActive") || undefined,
    });

  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const { data: canManage } = await supabase.rpc("can_manage_workspace", {
    target_workspace: parsed.data.workspaceId,
  });
  if (!canManage) return { ok: false, error: "forbidden" };

  const { data: ws } = await supabase
    .from("workspaces")
    .select("organization_id")
    .eq("id", parsed.data.workspaceId)
    .single();
  if (!ws) return { ok: false, error: "workspace_not_found" };

  const updates: Record<string, unknown> = {
    workspace_id: parsed.data.workspaceId,
    organization_id: ws.organization_id,
    sharepoint_connected: true,
    sharepoint_site_url: parsed.data.siteUrl,
    sharepoint_library_name: parsed.data.libraryName,
    sharepoint_folder: parsed.data.folderName,
    sharepoint_account_email: parsed.data.accountEmail || user.email || null,
    sharepoint_tenant_id: parsed.data.tenantId || null,
    sharepoint_client_id: parsed.data.clientId || null,
    sharepoint_connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.setActive === "true" || parsed.data.setActive === "on") {
    updates.active_provider = "sharepoint";
  }

  const { error } = await supabase.from("workspace_storage_configs").upsert(updates, {
    onConflict: "workspace_id",
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/workspaces/${parsed.data.workspaceId}`);
  return { ok: true };
}

export async function disconnectWorkspaceSharePoint(formData: FormData) {
  const parsed = z
    .object({
      workspaceId: z.string().uuid(),
    })
    .safeParse({
      workspaceId: formData.get("workspaceId"),
    });

  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const { data: canManage } = await supabase.rpc("can_manage_workspace", {
    target_workspace: parsed.data.workspaceId,
  });
  if (!canManage) return { ok: false, error: "forbidden" };

  const { data: existing } = await supabase
    .from("workspace_storage_configs")
    .select("active_provider")
    .eq("workspace_id", parsed.data.workspaceId)
    .maybeSingle();

  const updates: Record<string, unknown> = {
    sharepoint_connected: false,
    sharepoint_site_url: null,
    sharepoint_library_name: null,
    sharepoint_connected_at: null,
    updated_at: new Date().toISOString(),
  };

  if (existing?.active_provider === "sharepoint") {
    updates.active_provider = "local";
  }

  const { error } = await supabase
    .from("workspace_storage_configs")
    .update(updates)
    .eq("workspace_id", parsed.data.workspaceId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/workspaces/${parsed.data.workspaceId}`);
  return { ok: true };
}

export async function setOrganizationActiveStorageProvider(formData: FormData) {
  const parsed = z
    .object({
      organizationId: z.string().uuid(),
      provider: z.enum(["local", "google_drive", "onedrive", "sharepoint"]),
    })
    .safeParse({
      organizationId: formData.get("organizationId"),
      provider: formData.get("provider"),
    });

  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const { data: canManage } = await supabase.rpc("has_org_role", {
    target_org: parsed.data.organizationId,
    allowed_roles: ["owner", "admin"],
  });
  if (!canManage) return { ok: false, error: "forbidden" };

  const { error } = await supabase.from("organization_storage_configs").upsert(
    {
      organization_id: parsed.data.organizationId,
      active_provider: parsed.data.provider,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" }
  );

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/organizations/${parsed.data.organizationId}/integrations`);
  return { ok: true };
}

export async function saveOrganizationOneDriveConfig(formData: FormData) {
  const parsed = z
    .object({
      organizationId: z.string().uuid(),
      accountEmail: z.string().email().optional().or(z.literal("")),
      folderName: z.string().max(120).optional().default("Orbitwork"),
      setActive: z.string().optional(),
    })
    .safeParse({
      organizationId: formData.get("organizationId"),
      accountEmail: formData.get("accountEmail") || undefined,
      folderName: formData.get("folderName") || "Orbitwork",
      setActive: formData.get("setActive") || undefined,
    });

  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const { data: canManage } = await supabase.rpc("has_org_role", {
    target_org: parsed.data.organizationId,
    allowed_roles: ["owner", "admin"],
  });
  if (!canManage) return { ok: false, error: "forbidden" };

  const updates: Record<string, unknown> = {
    organization_id: parsed.data.organizationId,
    onedrive_connected: true,
    onedrive_account_email: parsed.data.accountEmail || user.email || null,
    onedrive_folder: parsed.data.folderName,
    onedrive_connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.setActive === "true" || parsed.data.setActive === "on") {
    updates.active_provider = "onedrive";
  }

  const { error } = await supabase.from("organization_storage_configs").upsert(updates, {
    onConflict: "organization_id",
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/organizations/${parsed.data.organizationId}/integrations`);
  return { ok: true };
}

export async function disconnectOrganizationOneDrive(formData: FormData) {
  const parsed = z
    .object({
      organizationId: z.string().uuid(),
    })
    .safeParse({
      organizationId: formData.get("organizationId"),
    });

  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const { data: canManage } = await supabase.rpc("has_org_role", {
    target_org: parsed.data.organizationId,
    allowed_roles: ["owner", "admin"],
  });
  if (!canManage) return { ok: false, error: "forbidden" };

  const { data: existing } = await supabase
    .from("organization_storage_configs")
    .select("active_provider")
    .eq("organization_id", parsed.data.organizationId)
    .maybeSingle();

  const updates: Record<string, unknown> = {
    onedrive_connected: false,
    onedrive_account_email: null,
    onedrive_connected_at: null,
    updated_at: new Date().toISOString(),
  };

  if (existing?.active_provider === "onedrive") {
    updates.active_provider = "local";
  }

  const { error } = await supabase
    .from("organization_storage_configs")
    .update(updates)
    .eq("organization_id", parsed.data.organizationId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/organizations/${parsed.data.organizationId}/integrations`);
  return { ok: true };
}

export async function saveOrganizationSharePointConfig(formData: FormData) {
  const parsed = z
    .object({
      organizationId: z.string().uuid(),
      siteUrl: z.string().url("Must be a valid URL, e.g. https://company.sharepoint.com/sites/team"),
      libraryName: z.string().max(100).optional().default("Documents"),
      folderName: z.string().max(120).optional().default("Orbitwork"),
      accountEmail: z.string().email().optional().or(z.literal("")),
      setActive: z.string().optional(),
    })
    .safeParse({
      organizationId: formData.get("organizationId"),
      siteUrl: formData.get("siteUrl"),
      libraryName: formData.get("libraryName") || "Documents",
      folderName: formData.get("folderName") || "Orbitwork",
      accountEmail: formData.get("accountEmail") || undefined,
      setActive: formData.get("setActive") || undefined,
    });

  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const { data: canManage } = await supabase.rpc("has_org_role", {
    target_org: parsed.data.organizationId,
    allowed_roles: ["owner", "admin"],
  });
  if (!canManage) return { ok: false, error: "forbidden" };

  const updates: Record<string, unknown> = {
    organization_id: parsed.data.organizationId,
    sharepoint_connected: true,
    sharepoint_site_url: parsed.data.siteUrl,
    sharepoint_library_name: parsed.data.libraryName,
    sharepoint_folder: parsed.data.folderName,
    sharepoint_account_email: parsed.data.accountEmail || user.email || null,
    sharepoint_connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.setActive === "true" || parsed.data.setActive === "on") {
    updates.active_provider = "sharepoint";
  }

  const { error } = await supabase.from("organization_storage_configs").upsert(updates, {
    onConflict: "organization_id",
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/organizations/${parsed.data.organizationId}/integrations`);
  return { ok: true };
}

export async function disconnectOrganizationSharePoint(formData: FormData) {
  const parsed = z
    .object({
      organizationId: z.string().uuid(),
    })
    .safeParse({
      organizationId: formData.get("organizationId"),
    });

  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const { data: canManage } = await supabase.rpc("has_org_role", {
    target_org: parsed.data.organizationId,
    allowed_roles: ["owner", "admin"],
  });
  if (!canManage) return { ok: false, error: "forbidden" };

  const { data: existing } = await supabase
    .from("organization_storage_configs")
    .select("active_provider")
    .eq("organization_id", parsed.data.organizationId)
    .maybeSingle();

  const updates: Record<string, unknown> = {
    sharepoint_connected: false,
    sharepoint_site_url: null,
    sharepoint_library_name: null,
    sharepoint_connected_at: null,
    updated_at: new Date().toISOString(),
  };

  if (existing?.active_provider === "sharepoint") {
    updates.active_provider = "local";
  }

  const { error } = await supabase
    .from("organization_storage_configs")
    .update(updates)
    .eq("organization_id", parsed.data.organizationId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/organizations/${parsed.data.organizationId}/integrations`);
  return { ok: true };
}
