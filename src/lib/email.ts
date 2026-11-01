import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { formatMinutes, formatRemaining } from "./work.ts";

// Cache transporter instance
let cachedTransporter: Transporter | null = null;

// Track sent due date reminders in-memory per day: `${taskId}_${userId}_${YYYY-MM-DD}`
const sentDueRemindersToday = new Set<string>();

// Track sent hours exhausting alerts in-memory: `${taskId}_${tier}` -> timestamp ms
export const sentHoursExhaustingAlerts = new Map<string, number>();

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || `"Orbitwork" <no-reply@orbitwork.app>`;

  const isConfigured = Boolean(host && user && pass);
  return { host, port, secure, user, pass, from, isConfigured };
}

export function getTransporter(): Transporter | null {
  const config = getSmtpConfig();
  if (!config.isConfigured) {
    return null;
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }
  return cachedTransporter;
}

/**
 * Send an email using SMTP if configured, or log to console in development.
 */
export async function sendEmail({ to, subject, html, text }: EmailOptions): Promise<{ ok: boolean; messageId?: string; simulated?: boolean; error?: string }> {
  const config = getSmtpConfig();
  const transporter = getTransporter();

  const plainText = text || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  if (!transporter) {
    // Simulated / Dev mode
    console.log("------------------------------------------------------------");
    console.log(`📧 [EMAIL NOTIFICATION (Simulated Mode)]`);
    console.log(`To:      ${to}`);
    console.log(`From:    ${config.from}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:    ${plainText.slice(0, 200)}...`);
    console.log("------------------------------------------------------------");
    return { ok: true, simulated: true };
  }

  try {
    const info = await transporter.sendMail({
      from: config.from,
      to,
      subject,
      text: plainText,
      html,
    });
    console.log(`📧 [EMAIL SENT] MessageId: ${info.messageId} To: ${to} Subject: "${subject}"`);
    return { ok: true, messageId: info.messageId };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`❌ [EMAIL SEND ERROR] To: ${to} Subject: "${subject}":`, errorMessage);
    return { ok: false, error: errorMessage };
  }
}

// -------------------------------------------------------------
// HTML Email Templates
// -------------------------------------------------------------

function getPriorityBadge(priority: string) {
  const colors: Record<string, { bg: string; text: string }> = {
    urgent: { bg: "#fef2f2", text: "#b91c1c" },
    high: { bg: "#fffbeb", text: "#b45309" },
    normal: { bg: "#f0fdf4", text: "#15803d" },
    low: { bg: "#f8fafc", text: "#475569" },
  };
  const color = colors[priority.toLowerCase()] || colors.normal;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase;background-color:${color.bg};color:${color.text};">${priority}</span>`;
}

function emailWrapper(content: string, title: string): string {
  const appUrl = getAppUrl();
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: #065f46; padding: 20px 24px; color: #ffffff; }
    .header h1 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }
    .body { padding: 24px; font-size: 14px; line-height: 1.6; color: #334155; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .btn { display: inline-block; background-color: #059669; color: #ffffff !important; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 13px; margin-top: 12px; }
    .footer { padding: 16px 24px; background: #f1f5f9; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center; }
    .quote-box { border-left: 3px solid #059669; padding-left: 12px; margin: 12px 0; color: #1e293b; font-style: italic; background: #f8fafc; padding: 10px 14px; border-radius: 0 6px 6px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Orbitwork Notification</h1>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      Sent by <a href="${appUrl}" style="color:#059669;text-decoration:none;font-weight:600;">Orbitwork</a> · Projects &amp; Work Management
    </div>
  </div>
</body>
</html>`;
}

// -------------------------------------------------------------
// Notification Dispatchers
// -------------------------------------------------------------

export interface TaskAssignedEmailParams {
  recipientEmail: string;
  recipientName: string;
  assignerName: string;
  taskTitle: string;
  taskKey: string;
  taskId: string;
  projectName: string;
  projectId: string;
  priority: string;
  dueDate?: string | null;
  description?: string | null;
}

/**
 * Send email when a user is assigned to a task.
 */
export async function sendTaskAssignedEmail(params: TaskAssignedEmailParams) {
  const taskUrl = `${getAppUrl()}/projects/${params.projectId}/tasks/${params.taskId}`;
  const subject = `[Task Assigned] ${params.taskKey}: ${params.taskTitle}`;

  const html = emailWrapper(`
    <p>Hi <strong>${params.recipientName}</strong>,</p>
    <p><strong>${params.assignerName}</strong> assigned you to a task in <strong>${params.projectName}</strong>:</p>

    <div class="card">
      <div style="font-size:12px;color:#64748b;font-weight:700;margin-bottom:4px;">${params.taskKey}</div>
      <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:8px;">${params.taskTitle}</div>
      <div style="margin-bottom:8px;">
        <span style="font-size:12px;color:#64748b;margin-right:6px;">Priority:</span> ${getPriorityBadge(params.priority)}
        ${params.dueDate ? `<span style="font-size:12px;color:#64748b;margin-left:14px;margin-right:4px;">Due:</span> <strong style="font-size:12px;color:#0f172a;">${params.dueDate}</strong>` : ""}
      </div>
      ${params.description ? `<p style="font-size:13px;color:#475569;margin-top:8px;border-top:1px solid #e2e8f0;padding-top:8px;">${params.description.slice(0, 300)}</p>` : ""}
      <a href="${taskUrl}" class="btn">View Task</a>
    </div>
  `, subject);

  return sendEmail({
    to: params.recipientEmail,
    subject,
    html,
  });
}

export interface DueReminderEmailParams {
  recipientEmail: string;
  recipientName: string;
  taskTitle: string;
  taskKey: string;
  taskId: string;
  projectName: string;
  projectId: string;
  priority: string;
  dueDate: string;
  isOverdue: boolean;
}

/**
 * Send email reminder when a task is due today or overdue.
 */
export async function sendTaskDueReminderEmail(params: DueReminderEmailParams) {
  const taskUrl = `${getAppUrl()}/projects/${params.projectId}/tasks/${params.taskId}`;
  const statusLabel = params.isOverdue ? "OVERDUE" : "DUE TODAY";
  const subject = `[${statusLabel}] ${params.taskKey}: ${params.taskTitle}`;

  const html = emailWrapper(`
    <p>Hi <strong>${params.recipientName}</strong>,</p>
    <p>This is a reminder that the following task in <strong>${params.projectName}</strong> is <strong style="color:${params.isOverdue ? "#dc2626" : "#d97706"};">${statusLabel}</strong>:</p>

    <div class="card" style="border-left:4px solid ${params.isOverdue ? "#dc2626" : "#f59e0b"};">
      <div style="font-size:12px;color:#64748b;font-weight:700;margin-bottom:4px;">${params.taskKey}</div>
      <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:8px;">${params.taskTitle}</div>
      <div style="margin-bottom:8px;">
        <span style="font-size:12px;color:#64748b;margin-right:6px;">Priority:</span> ${getPriorityBadge(params.priority)}
        <span style="font-size:12px;color:#64748b;margin-left:14px;margin-right:4px;">Due Date:</span> <strong style="color:${params.isOverdue ? "#dc2626" : "#d97706"};">${params.dueDate}</strong>
      </div>
      <a href="${taskUrl}" class="btn">Open Task &amp; Update Status</a>
    </div>
  `, subject);

  return sendEmail({
    to: params.recipientEmail,
    subject,
    html,
  });
}

export interface MentionEmailParams {
  recipientEmail: string;
  recipientName: string;
  authorName: string;
  taskTitle: string;
  taskKey: string;
  taskId: string;
  projectName: string;
  projectId: string;
  commentBody: string;
}

/**
 * Send email when someone is mentioned in a comment or discussion.
 */
export async function sendUserMentionedEmail(params: MentionEmailParams) {
  const taskUrl = `${getAppUrl()}/projects/${params.projectId}/tasks/${params.taskId}`;
  const subject = `[Mentioned] ${params.authorName} mentioned you on ${params.taskKey}: ${params.taskTitle}`;

  const html = emailWrapper(`
    <p>Hi <strong>${params.recipientName}</strong>,</p>
    <p><strong>${params.authorName}</strong> mentioned you in a comment on task <strong>${params.taskKey}</strong> (${params.taskTitle}):</p>

    <div class="quote-box">
      ${params.commentBody.replace(/\n/g, "<br>")}
    </div>

    <div style="margin-top:16px;">
      <a href="${taskUrl}" class="btn">Reply to Comment</a>
    </div>
  `, subject);

  return sendEmail({
    to: params.recipientEmail,
    subject,
    html,
  });
}

export interface HoursExhaustingEmailParams {
  recipientEmail: string;
  recipientName: string;
  taskTitle: string;
  taskKey: string;
  taskId: string;
  projectName: string;
  projectId: string;
  estimateMinutes: number;
  workedMinutes: number;
  remainingMinutes: number;
}

/**
 * Send email alert when a task's budgeted hours are exhausting (less than 1 hour remaining or exceeded).
 */
export async function sendTaskHoursExhaustingEmail(params: HoursExhaustingEmailParams) {
  const taskUrl = `${getAppUrl()}/projects/${params.projectId}/tasks/${params.taskId}`;
  const isExceeded = params.remainingMinutes <= 0;
  const remainingLabel = isExceeded
    ? `Exceeded by ${formatMinutes(Math.abs(params.remainingMinutes))}`
    : `Only ${formatMinutes(params.remainingMinutes)} remaining`;

  const statusLabel = isExceeded ? "HOURS EXHAUSTED" : "HOURS EXHAUSTING ALERT";
  const subject = `[${statusLabel}] ${params.taskKey}: ${params.taskTitle} (${remainingLabel})`;

  const accentColor = isExceeded ? "#dc2626" : "#d97706";
  const bgColor = isExceeded ? "#fef2f2" : "#fffbeb";
  const borderColor = isExceeded ? "#fecaca" : "#fde68a";

  const html = emailWrapper(`
    <p>Hi <strong>${params.recipientName}</strong>,</p>
    <p>This is an automated alert to notify you that the hours for task <strong>${params.taskKey}</strong> in <strong>${params.projectName}</strong> are <strong style="color:${accentColor};">${isExceeded ? "exhausted and have exceeded the estimated budget" : "almost exhausted (less than 1 hour remains)"}</strong>.</p>

    <div class="card" style="border-left:4px solid ${accentColor};background:${bgColor};border:1px solid ${borderColor};border-radius:8px;padding:16px;margin:16px 0;">
      <div style="font-size:12px;color:#64748b;font-weight:700;margin-bottom:4px;">${params.taskKey}</div>
      <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:12px;">${params.taskTitle}</div>

      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:14px;">
        <tr>
          <td style="padding:6px 0;color:#64748b;width:50%;">Estimated Budget:</td>
          <td style="padding:6px 0;font-weight:700;color:#0f172a;">${formatMinutes(params.estimateMinutes)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;">Billable Hours Worked:</td>
          <td style="padding:6px 0;font-weight:700;color:#0f172a;">${formatMinutes(params.workedMinutes)}</td>
        </tr>
        <tr style="border-top:1px dashed ${borderColor};">
          <td style="padding:8px 0;font-weight:600;color:${accentColor};">Remaining Balance:</td>
          <td style="padding:8px 0;font-weight:700;color:${accentColor};">${remainingLabel}</td>
        </tr>
      </table>

      <a href="${taskUrl}" class="btn" style="background:${accentColor};color:#ffffff;display:inline-block;padding:9px 18px;text-decoration:none;border-radius:6px;font-weight:600;">Review Task &amp; Timesheets</a>
    </div>

    <p style="font-size:12px;color:#64748b;">This alert was automatically sent to the task creator and assignees to ensure hours and estimates are aligned.</p>
  `, subject);

  return sendEmail({
    to: params.recipientEmail,
    subject,
    html,
  });
}

// -------------------------------------------------------------
// High-Level Handlers for Actions & API
// -------------------------------------------------------------

/**
 * Notify all assigned users when a task is created or its assignees are updated.
 */
export async function notifyAssigneesOnTask({
  projectId,
  taskId,
  assigneeIds,
  actorId,
}: {
  projectId: string;
  taskId: string;
  assigneeIds: string[];
  actorId: string;
}) {
  if (!assigneeIds || assigneeIds.length === 0) return;

  try {
    const { createClient } = await import("./supabase/server");
    const supabase = await createClient();

    // 1. Get task details
    const { data: task } = await supabase
      .from("tasks")
      .select("id, generated_key, title, description, priority, due_date")
      .eq("id", taskId)
      .maybeSingle();

    if (!task) return;

    // 2. Get project details
    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .maybeSingle();

    // 3. Get actor/assigner name
    const { data: actorProfile } = await supabase
      .from("profiles")
      .select("display_name, email")
      .eq("id", actorId)
      .maybeSingle();

    const assignerName = actorProfile?.display_name?.trim() || actorProfile?.email || "A teammate";

    // 4. Filter out the assigner from recipients
    const targetUserIds = assigneeIds.filter((id) => id && id !== actorId);
    if (targetUserIds.length === 0) return;

    // 5. Fetch profiles for target users
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, email")
      .in("id", targetUserIds);

    if (!profiles || profiles.length === 0) return;

    for (const profile of profiles) {
      if (!profile.email) continue;
      const recipientName = profile.display_name?.trim() || profile.email;

      await sendTaskAssignedEmail({
        recipientEmail: profile.email,
        recipientName,
        assignerName,
        taskTitle: task.title,
        taskKey: task.generated_key,
        taskId: task.id,
        projectName: project?.name || "Project",
        projectId,
        priority: task.priority || "normal",
        dueDate: task.due_date,
        description: task.description,
      });
    }
  } catch (err) {
    console.error("Error sending task assignment notifications:", err);
  }
}

/**
 * Extract mentions from text and send emails to mentioned team members.
 */
export async function notifyMentionedUsers({
  projectId,
  taskId,
  commentBody,
  authorId,
}: {
  projectId: string;
  taskId: string;
  commentBody: string;
  authorId: string;
}) {
  if (!commentBody || !commentBody.includes("@")) return;

  try {
    const { createClient } = await import("./supabase/server");
    const supabase = await createClient();

    // 1. Get task & project details
    const { data: task } = await supabase
      .from("tasks")
      .select("id, generated_key, title, project_id")
      .eq("id", taskId)
      .maybeSingle();

    if (!task) return;

    const { data: project } = await supabase
      .from("projects")
      .select("id, name, workspace_id, workspaces(organization_id)")
      .eq("id", projectId)
      .maybeSingle();

    // 2. Get author name
    const { data: authorProfile } = await supabase
      .from("profiles")
      .select("display_name, email")
      .eq("id", authorId)
      .maybeSingle();

    const authorName = authorProfile?.display_name?.trim() || authorProfile?.email || "A teammate";

    // 3. Find organization members to match mentions against
    const workspace = Array.isArray(project?.workspaces) ? project?.workspaces[0] : project?.workspaces;
    const orgId = workspace?.organization_id;

    let orgUserIds: string[] = [];
    if (orgId) {
      const { data: members } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", orgId)
        .eq("status", "active");
      orgUserIds = (members ?? []).map((m) => m.user_id);
    }

    // Also get project members
    const { data: projectMembers } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", projectId);

    const candidateUserIds = [...new Set([...orgUserIds, ...(projectMembers ?? []).map((p) => p.user_id)])].filter(
      (id) => id !== authorId
    );

    if (candidateUserIds.length === 0) return;

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, email")
      .in("id", candidateUserIds);

    if (!profiles || profiles.length === 0) return;

    // 4. Resolve which users were mentioned in the commentBody
    // Supports @email, @username, @Display Name (e.g. "@Charan Admin", "@charantony88", "@john")
    const lowerBody = commentBody.toLowerCase();
    const mentionedProfiles: typeof profiles = [];

    for (const p of profiles) {
      const email = p.email?.toLowerCase();
      const displayName = p.display_name?.trim().toLowerCase();
      const username = email ? email.split("@")[0] : "";
      const firstName = displayName ? displayName.split(" ")[0] : "";

      let isMentioned = false;

      // Check full email mention: @user@domain.com
      if (email && lowerBody.includes(`@${email}`)) {
        isMentioned = true;
      }
      // Check full display name mention: @charan admin
      else if (displayName && lowerBody.includes(`@${displayName}`)) {
        isMentioned = true;
      }
      // Check username prefix: @charantony88
      else if (username && username.length >= 3 && lowerBody.includes(`@${username}`)) {
        isMentioned = true;
      }
      // Check first name if unique/clear: e.g. @charan
      else if (firstName && firstName.length >= 3) {
        const regex = new RegExp(`@${firstName}\\b`, "i");
        if (regex.test(lowerBody)) {
          isMentioned = true;
        }
      }

      if (isMentioned && p.email) {
        mentionedProfiles.push(p);
      }
    }

    // 5. Send mention email to each matched member
    for (const recipient of mentionedProfiles) {
      await sendUserMentionedEmail({
        recipientEmail: recipient.email,
        recipientName: recipient.display_name?.trim() || recipient.email,
        authorName,
        taskTitle: task.title,
        taskKey: task.generated_key,
        taskId: task.id,
        projectName: project?.name || "Project",
        projectId,
        commentBody,
      });
    }
  } catch (err) {
    console.error("Error notifying mentioned users:", err);
  }
}

/**
 * Scan for tasks that are due today or overdue and send email reminders to assignees.
 * Only sends once per task/user per day.
 */
export async function checkAndSendDueDateReminders(targetProjectId?: string) {
  try {
    const { createClient } = await import("./supabase/server");
    const supabase = await createClient();
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // Fetch tasks where due_date <= today and not completed/cancelled
    let query = supabase
      .from("tasks")
      .select(`
        id,
        generated_key,
        title,
        priority,
        due_date,
        project_id,
        primary_assignee_id,
        secondary_assignee_id,
        project_statuses ( category ),
        projects ( id, name )
      `)
      .not("due_date", "is", null)
      .lte("due_date", today);

    if (targetProjectId) {
      query = query.eq("project_id", targetProjectId);
    }

    const { data: tasks, error } = await query;
    if (error || !tasks) {
      console.error("Could not fetch tasks for due date reminders:", error);
      return { ok: false, sentCount: 0 };
    }

    let sentCount = 0;

    for (const task of tasks) {
      // Skip completed or cancelled tasks
      const statusCategory = (task.project_statuses as { category?: string } | null)?.category;
      if (statusCategory === "completed" || statusCategory === "cancelled") {
        continue;
      }

      // Collect all assignees for this task
      // 1. From task table (primary & secondary)
      const directAssigneeIds = [task.primary_assignee_id, task.secondary_assignee_id].filter(
        (id): id is string => Boolean(id)
      );

      // 2. From task_assignees table
      const { data: assignedRows } = await supabase
        .from("task_assignees")
        .select("user_id")
        .eq("task_id", task.id);

      const allAssigneeIds = [
        ...new Set([...directAssigneeIds, ...(assignedRows ?? []).map((r) => r.user_id)]),
      ];

      if (allAssigneeIds.length === 0) continue;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", allAssigneeIds);

      if (!profiles || profiles.length === 0) continue;

      const isOverdue = Boolean(task.due_date && task.due_date < today);
      const projectData = Array.isArray(task.projects) ? task.projects[0] : task.projects;
      const projectName = (projectData as { name?: string } | null)?.name || "Project";

      for (const profile of profiles) {
        if (!profile.email) continue;

        // Dedup: ensure we don't send reminder multiple times on the same day
        const reminderKey = `${task.id}_${profile.id}_${today}`;
        if (sentDueRemindersToday.has(reminderKey)) {
          continue;
        }

        const res = await sendTaskDueReminderEmail({
          recipientEmail: profile.email,
          recipientName: profile.display_name?.trim() || profile.email,
          taskTitle: task.title,
          taskKey: task.generated_key,
          taskId: task.id,
          projectName,
          projectId: task.project_id,
          priority: task.priority || "normal",
          dueDate: task.due_date!,
          isOverdue,
        });

        if (res.ok) {
          sentDueRemindersToday.add(reminderKey);
          sentCount++;
        }
      }
    }

    return { ok: true, sentCount, tasksChecked: tasks.length };
  } catch (err) {
    console.error("Error in checkAndSendDueDateReminders:", err);
    return { ok: false, sentCount: 0, error: String(err) };
  }
}

/**
 * Check if a task's billable hours are exhausting (less than 1 hour remaining or exceeded),
 * and notify task creator and all assignees via email.
 */
export async function checkAndNotifyHoursExhausting({
  projectId,
  taskId,
}: {
  projectId: string;
  taskId: string;
}) {
  try {
    const { createClient } = await import("./supabase/server");
    const supabase = await createClient();

    // 1. Fetch task details
    const { data: task } = await supabase
      .from("tasks")
      .select("id, generated_key, title, estimate_minutes, created_by, primary_assignee_id, secondary_assignee_id, project_id")
      .eq("id", taskId)
      .maybeSingle();

    if (!task || !task.estimate_minutes || task.estimate_minutes <= 0) {
      return; // No estimate to compare against
    }

    // 2. Fetch all billable time entries for this task
    const { data: timeEntries } = await supabase
      .from("time_entries")
      .select("duration_minutes, billable, ended_at")
      .eq("task_id", taskId)
      .eq("billable", true)
      .not("ended_at", "is", null);

    const workedMinutes = (timeEntries ?? []).reduce(
      (sum, entry) => sum + (entry.duration_minutes || 0),
      0
    );

    const remainingMinutes = task.estimate_minutes - workedMinutes;

    // Only alert when less than 1 hour (60 minutes) remains or exceeded
    if (remainingMinutes >= 60) {
      return;
    }

    // Cooldown check: 4 hours cooldown per tier (warning vs exceeded)
    const tier = remainingMinutes <= 0 ? "exceeded" : "warning";
    const cacheKey = `${taskId}_${tier}`;
    const lastSent = sentHoursExhaustingAlerts.get(cacheKey);
    const now = Date.now();
    if (lastSent && now - lastSent < 4 * 60 * 60 * 1000) {
      return;
    }

    // 3. Fetch project details
    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .maybeSingle();

    // 4. Fetch all extra assignees from task_assignees
    const { data: extraAssignees } = await supabase
      .from("task_assignees")
      .select("user_id")
      .eq("task_id", taskId);

    const recipientUserIds = Array.from(
      new Set(
        [
          task.created_by,
          task.primary_assignee_id,
          task.secondary_assignee_id,
          ...(extraAssignees ?? []).map((r) => r.user_id),
        ].filter((id): id is string => Boolean(id))
      )
    );

    if (recipientUserIds.length === 0) return;

    // 5. Fetch profiles for recipients
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, email")
      .in("id", recipientUserIds);

    if (!profiles || profiles.length === 0) return;

    for (const profile of profiles) {
      if (!profile.email) continue;
      await sendTaskHoursExhaustingEmail({
        recipientEmail: profile.email,
        recipientName: profile.display_name?.trim() || profile.email,
        taskTitle: task.title,
        taskKey: task.generated_key || "TASK",
        taskId: task.id,
        projectName: project?.name || "Project",
        projectId,
        estimateMinutes: task.estimate_minutes,
        workedMinutes,
        remainingMinutes,
      });
    }

    sentHoursExhaustingAlerts.set(cacheKey, now);
  } catch (err) {
    console.error("Error in checkAndNotifyHoursExhausting:", err);
  }
}

// -------------------------------------------------------------
// User Registration & Admin Approval Emails
// -------------------------------------------------------------

export interface NewUserPendingAdminEmailParams {
  adminEmail: string;
  adminName: string;
  userEmail: string;
  signupDate?: string;
}

export async function sendAdminNewUserSignupAlert(params: NewUserPendingAdminEmailParams) {
  const loginUrl = `${getAppUrl()}/dashboard`;
  const subject = `[Action Required] New Account Registration Request: ${params.userEmail}`;

  const html = emailWrapper(`
    <p>Hi <strong>${params.adminName}</strong>,</p>
    <p>A new user has registered for Orbitwork and is <strong>awaiting your administrator approval</strong> before they can access the application.</p>

    <div class="card" style="border-left:4px solid #2563eb;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:16px 0;">
      <div style="font-size:12px;color:#64748b;font-weight:700;margin-bottom:4px;">NEW REGISTRATION REQUEST</div>
      <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:8px;">${params.userEmail}</div>
      <p style="font-size:13px;color:#475569;margin:0 0 14px;">Submitted: ${params.signupDate || new Date().toLocaleString()}</p>

      <a href="${loginUrl}" class="btn" style="background:#2563eb;color:#ffffff;display:inline-block;padding:9px 18px;text-decoration:none;border-radius:6px;font-weight:600;">Review &amp; Approve in Dashboard</a>
    </div>

    <p style="font-size:12px;color:#64748b;">You can accept or reject this registration request directly from your Orbitwork dashboard.</p>
  `, subject);

  return sendEmail({
    to: params.adminEmail,
    subject,
    html,
  });
}

export interface UserAccountApprovedEmailParams {
  recipientEmail: string;
  recipientName: string;
  organizationName?: string;
}

export async function sendUserAccountApprovedEmail(params: UserAccountApprovedEmailParams) {
  const loginUrl = `${getAppUrl()}/`;
  const subject = `Your Orbitwork Account Has Been Approved!`;

  const html = emailWrapper(`
    <p>Hi <strong>${params.recipientName}</strong>,</p>
    <p>Great news! Your registration request for Orbitwork${params.organizationName ? ` in <strong>${params.organizationName}</strong>` : ""} has been <strong>approved</strong> by the administrator.</p>

    <div class="card" style="border-left:4px solid #16a34a;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;">
      <div style="font-size:16px;font-weight:700;color:#15803d;margin-bottom:6px;">Account Active</div>
      <p style="font-size:13px;color:#166534;margin:0 0 14px;">You can now sign in with your email (<strong>${params.recipientEmail}</strong>) and password to access your workspaces.</p>

      <a href="${loginUrl}" class="btn" style="background:#16a34a;color:#ffffff;display:inline-block;padding:9px 18px;text-decoration:none;border-radius:6px;font-weight:600;">Sign In to Orbitwork</a>
    </div>
  `, subject);

  return sendEmail({
    to: params.recipientEmail,
    subject,
    html,
  });
}

/**
 * Notify organization owners/admins when a new user registers and awaits approval.
 */
export async function notifyAdminsOnNewSignup(userEmail: string) {
  try {
    const { createClient } = await import("./supabase/server");
    const supabase = await createClient();

    // Fetch active org owners and admins
    const { data: adminMembers } = await supabase
      .from("organization_members")
      .select("user_id, role")
      .in("role", ["owner", "admin"])
      .eq("status", "active");

    const adminUserIds = Array.from(new Set((adminMembers ?? []).map((m) => m.user_id)));

    let targetEmails: Array<{ email: string; name: string }> = [];

    if (adminUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("display_name, email")
        .in("id", adminUserIds);

      targetEmails = (profiles ?? [])
        .filter((p) => Boolean(p.email))
        .map((p) => ({ email: p.email, name: p.display_name?.trim() || "Administrator" }));
    }

    // Fallback: SMTP_USER if no admins found yet
    const fallbackEmail = process.env.SMTP_USER;
    if (targetEmails.length === 0 && fallbackEmail) {
      targetEmails.push({ email: fallbackEmail, name: "System Administrator" });
    }

    for (const admin of targetEmails) {
      await sendAdminNewUserSignupAlert({
        adminEmail: admin.email,
        adminName: admin.name,
        userEmail,
        signupDate: new Date().toLocaleString(),
      });
    }
  } catch (err) {
    console.error("Error notifying admins of new signup:", err);
  }
}
