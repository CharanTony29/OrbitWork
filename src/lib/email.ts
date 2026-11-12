import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { normalizeAppOrigin } from "./seo.ts";
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
  replyTo?: string;
}

export function getAppUrl(): string {
  return normalizeAppOrigin(process.env.NEXT_PUBLIC_APP_URL);
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
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
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
export async function sendEmail({ to, subject, html, text, replyTo }: EmailOptions): Promise<{ ok: boolean; messageId?: string; simulated?: boolean; error?: string }> {
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
      ...(replyTo ? { replyTo } : {}),
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

export interface TaskUnassignedEmailParams {
  recipientEmail: string;
  recipientName: string;
  actorName: string;
  taskTitle: string;
  taskKey: string;
  taskId: string;
  projectName: string;
  projectId: string;
  priority: string;
  dueDate?: string | null;
}

/**
 * Send email when a user is removed / unassigned from a task.
 */
export async function sendTaskUnassignedEmail(params: TaskUnassignedEmailParams) {
  const taskUrl = `${getAppUrl()}/projects/${params.projectId}/tasks/${params.taskId}`;
  const subject = `[Task Unassigned] ${params.taskKey}: ${params.taskTitle}`;

  const html = emailWrapper(`
    <p>Hi <strong>${params.recipientName}</strong>,</p>
    <p><strong>${params.actorName}</strong> removed you from a task in <strong>${params.projectName}</strong>:</p>

    <div class="card">
      <div style="font-size:12px;color:#64748b;font-weight:700;margin-bottom:4px;">${params.taskKey}</div>
      <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:8px;">${params.taskTitle}</div>
      <div style="margin-bottom:8px;">
        <span style="font-size:12px;color:#64748b;margin-right:6px;">Priority:</span> ${getPriorityBadge(params.priority)}
        ${params.dueDate ? `<span style="font-size:12px;color:#64748b;margin-left:14px;margin-right:4px;">Due:</span> <strong style="font-size:12px;color:#0f172a;">${params.dueDate}</strong>` : ""}
      </div>
      <p style="font-size:13px;color:#475569;margin-top:8px;border-top:1px solid #e2e8f0;padding-top:8px;">You are no longer assigned to this task.</p>
      <a href="${taskUrl}" class="btn">View Task</a>
    </div>
  `, subject);

  return sendEmail({
    to: params.recipientEmail,
    subject,
    html,
  });
}

function escapeEmailHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function isCompletedStatusNameOrCategory(category?: string | null, name?: string | null): boolean {
  if (category === "completed") return true;
  if (category === "cancelled") return false;
  if (!name) return false;
  return /\b(complete|completed|done|finished)\b/i.test(name);
}

export interface TaskCompletedEmailParams {
  recipientEmail: string;
  recipientName: string;
  completedByName: string;
  completedBySelf?: boolean;
  taskTitle: string;
  taskKey: string;
  taskId: string;
  projectName: string;
  projectId: string;
  statusName?: string | null;
  priority?: string | null;
}

/**
 * Send email to task creator when a task moves to a Completed status.
 */
export async function sendTaskCompletedEmail(params: TaskCompletedEmailParams) {
  const taskUrl = `${getAppUrl()}/projects/${params.projectId}/tasks/${params.taskId}`;
  const safeKey = escapeEmailHtml(params.taskKey || "TASK");
  const safeTitle = escapeEmailHtml(params.taskTitle);
  const safeProject = escapeEmailHtml(params.projectName || "Project");
  const safeRecipient = escapeEmailHtml(params.recipientName);
  const safeActor = escapeEmailHtml(params.completedByName);
  const statusLabel = escapeEmailHtml(params.statusName || "Completed");
  const subject = `[Task Completed] ${params.taskKey}: ${params.taskTitle}`;

  const actionLine = params.completedBySelf
    ? `You marked a task you created in <strong>${safeProject}</strong> as <strong>${statusLabel}</strong>:`
    : `<strong>${safeActor}</strong> marked a task you created in <strong>${safeProject}</strong> as <strong>${statusLabel}</strong>:`;

  const html = emailWrapper(`
    <p>Hi <strong>${safeRecipient}</strong>,</p>
    <p>${actionLine}</p>

    <div class="card" style="border-left:4px solid #059669;background:#f0fdf4;border:1px solid #bbf7d0;">
      <div style="font-size:12px;color:#047857;font-weight:700;margin-bottom:4px;">${safeKey} · ${statusLabel}</div>
      <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:8px;">${safeTitle}</div>
      ${params.priority ? `<div style="margin-bottom:8px;"><span style="font-size:12px;color:#64748b;margin-right:6px;">Priority:</span> ${getPriorityBadge(params.priority)}</div>` : ""}
      <a href="${taskUrl}" class="btn">View Completed Task</a>
    </div>
  `, subject);

  return sendEmail({
    to: params.recipientEmail,
    subject,
    html,
  });
}

export interface ChannelMentionEmailParams {
  recipientEmail: string;
  recipientName: string;
  authorName: string;
  projectName: string;
  projectId: string;
  postBody: string;
}

/**
 * Send email when a team member is mentioned in a project channel post.
 */
export async function sendChannelMentionEmail(params: ChannelMentionEmailParams) {
  const channelUrl = `${getAppUrl()}/projects/${params.projectId}?view=channel`;
  const safeProject = escapeEmailHtml(params.projectName || "Project");
  const safeRecipient = escapeEmailHtml(params.recipientName);
  const safeAuthor = escapeEmailHtml(params.authorName);
  const snippet = escapeEmailHtml((params.postBody || "").slice(0, 500)).replace(/\n/g, "<br>");
  const subject = `[Channel Mention] ${params.authorName} mentioned you in ${params.projectName}`;

  const html = emailWrapper(`
    <p>Hi <strong>${safeRecipient}</strong>,</p>
    <p><strong>${safeAuthor}</strong> mentioned you in the <strong>${safeProject}</strong> team channel:</p>

    <div class="quote-box">
      ${snippet || "<em>Shared attachments/documents in the channel.</em>"}
    </div>

    <div style="margin-top:16px;">
      <a href="${channelUrl}" class="btn">Open Team Channel</a>
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

interface RecipientContact {
  id: string;
  email: string;
  display_name: string | null;
}

type AnySupabaseClient = Awaited<ReturnType<typeof import("./supabase/server")["createClient"]>>;

async function resolveRecipientContacts(
  supabase: AnySupabaseClient,
  adminClient: ReturnType<typeof import("./supabase/server")["createAdminClient"]>,
  userIds: string[]
): Promise<RecipientContact[]> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  const reader = adminClient ?? supabase;
  const { data: profiles } = await reader
    .from("profiles")
    .select("id, display_name, email")
    .in("id", uniqueIds);

  const byId = new Map<string, RecipientContact>();
  for (const p of profiles ?? []) {
    byId.set(p.id, {
      id: p.id,
      email: (p.email ?? "").trim(),
      display_name: p.display_name ?? null,
    });
  }

  // Fallback to Supabase Auth admin user record whenever profile.email is blank or missing
  if (adminClient) {
    const missingOrBlank = uniqueIds.filter((uid) => !byId.get(uid)?.email);
    await Promise.allSettled(
      missingOrBlank.map(async (uid) => {
        const { data } = await adminClient.auth.admin.getUserById(uid);
        const authEmail = data?.user?.email?.trim();
        if (authEmail) {
          const existing = byId.get(uid);
          const metaName =
            typeof data.user?.user_metadata?.full_name === "string"
              ? data.user.user_metadata.full_name
              : typeof data.user?.user_metadata?.name === "string"
              ? data.user.user_metadata.name
              : null;
          byId.set(uid, {
            id: uid,
            email: authEmail,
            display_name: existing?.display_name || metaName || null,
          });
        }
      })
    );
  }

  return Array.from(byId.values());
}

async function resolveProjectCandidateUserIds(
  reader: AnySupabaseClient,
  projectId: string,
  excludeUserId?: string
): Promise<{ candidateUserIds: string[]; projectName: string }> {
  const { data: project } = await reader
    .from("projects")
    .select("id, name, workspace_id, workspaces(organization_id)")
    .eq("id", projectId)
    .maybeSingle();

  const workspace = Array.isArray(project?.workspaces) ? project?.workspaces[0] : project?.workspaces;
  const orgId = workspace?.organization_id;

  const [orgRes, wsRes, projRes] = await Promise.all([
    orgId
      ? reader
          .from("organization_members")
          .select("user_id")
          .eq("organization_id", orgId)
          .eq("status", "active")
      : Promise.resolve({ data: [] as { user_id: string }[] }),
    project?.workspace_id
      ? reader
          .from("workspace_members")
          .select("user_id")
          .eq("workspace_id", project.workspace_id)
      : Promise.resolve({ data: [] as { user_id: string }[] }),
    reader.from("project_members").select("user_id").eq("project_id", projectId),
  ]);

  const ids = new Set<string>();
  for (const m of orgRes.data ?? []) if (m.user_id) ids.add(m.user_id);
  for (const m of wsRes.data ?? []) if (m.user_id) ids.add(m.user_id);
  for (const m of projRes.data ?? []) if (m.user_id) ids.add(m.user_id);
  if (excludeUserId) ids.delete(excludeUserId);

  return {
    candidateUserIds: Array.from(ids),
    projectName: project?.name || "Project",
  };
}

function findMentionedContacts(
  body: string,
  contacts: RecipientContact[],
  explicitMentionIds?: string[]
): RecipientContact[] {
  const explicitSet = new Set(explicitMentionIds ?? []);
  const lowerBody = (body || "").toLowerCase();
  const matched: RecipientContact[] = [];

  for (const c of contacts) {
    if (explicitSet.has(c.id)) {
      matched.push(c);
      continue;
    }
    if (!lowerBody.includes("@")) continue;

    const email = c.email.toLowerCase();
    const displayName = c.display_name?.trim().toLowerCase() || "";
    const username = email ? email.split("@")[0] : "";
    const firstName = displayName ? displayName.split(/\s+/)[0] : "";

    let isMentioned = false;
    if (email && lowerBody.includes(`@${email}`)) {
      isMentioned = true;
    } else if (displayName && lowerBody.includes(`@${displayName}`)) {
      isMentioned = true;
    } else if (username && username.length >= 3 && lowerBody.includes(`@${username}`)) {
      isMentioned = true;
    } else if (firstName && firstName.length >= 3) {
      const escaped = firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`@${escaped}\\b`, "i");
      if (regex.test(lowerBody)) {
        isMentioned = true;
      }
    }

    if (isMentioned) {
      matched.push(c);
    }
  }

  return matched;
}

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
    const { createClient, createAdminClient } = await import("./supabase/server");
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const reader = adminClient ?? supabase;

    const [{ data: task }, { data: project }] = await Promise.all([
      reader
        .from("tasks")
        .select("id, generated_key, title, description, priority, due_date")
        .eq("id", taskId)
        .maybeSingle(),
      reader.from("projects").select("name").eq("id", projectId).maybeSingle(),
    ]);

    if (!task) return;

    const targetUserIds = assigneeIds.filter((id) => id && id !== actorId);
    if (targetUserIds.length === 0) return;

    const [actorContacts, recipientContacts] = await Promise.all([
      resolveRecipientContacts(supabase, adminClient, [actorId]),
      resolveRecipientContacts(supabase, adminClient, targetUserIds),
    ]);

    const actor = actorContacts[0];
    const assignerName = actor?.display_name?.trim() || actor?.email || "A teammate";

    await Promise.allSettled(
      recipientContacts
        .filter((r) => r.email)
        .map((recipient) =>
          sendTaskAssignedEmail({
            recipientEmail: recipient.email,
            recipientName: recipient.display_name?.trim() || recipient.email,
            assignerName,
            taskTitle: task.title,
            taskKey: task.generated_key,
            taskId: task.id,
            projectName: project?.name || "Project",
            projectId,
            priority: task.priority || "normal",
            dueDate: task.due_date,
            description: task.description,
          })
        )
    );
  } catch (err) {
    console.error("Error sending task assignment notifications:", err);
  }
}

/**
 * Notify users who were unassigned / removed from a task.
 */
export async function notifyRemovedAssigneesOnTask({
  projectId,
  taskId,
  removedAssigneeIds,
  actorId,
}: {
  projectId: string;
  taskId: string;
  removedAssigneeIds: string[];
  actorId: string;
}) {
  if (!removedAssigneeIds || removedAssigneeIds.length === 0) return;

  try {
    const { createClient, createAdminClient } = await import("./supabase/server");
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const reader = adminClient ?? supabase;

    const [{ data: task }, { data: project }] = await Promise.all([
      reader
        .from("tasks")
        .select("id, generated_key, title, priority, due_date")
        .eq("id", taskId)
        .maybeSingle(),
      reader.from("projects").select("name").eq("id", projectId).maybeSingle(),
    ]);

    if (!task) return;

    const targetUserIds = removedAssigneeIds.filter((id) => id && id !== actorId);
    if (targetUserIds.length === 0) return;

    const [actorContacts, recipientContacts] = await Promise.all([
      resolveRecipientContacts(supabase, adminClient, [actorId]),
      resolveRecipientContacts(supabase, adminClient, targetUserIds),
    ]);

    const actor = actorContacts[0];
    const actorName = actor?.display_name?.trim() || actor?.email || "A teammate";

    await Promise.allSettled(
      recipientContacts
        .filter((r) => r.email)
        .map((recipient) =>
          sendTaskUnassignedEmail({
            recipientEmail: recipient.email,
            recipientName: recipient.display_name?.trim() || recipient.email,
            actorName,
            taskTitle: task.title,
            taskKey: task.generated_key,
            taskId: task.id,
            projectName: project?.name || "Project",
            projectId,
            priority: task.priority || "normal",
            dueDate: task.due_date,
          })
        )
    );
  } catch (err) {
    console.error("Error sending task unassignment notifications:", err);
  }
}

/**
 * Notify the task creator once a task transitions to a Completed status.
 */
export async function notifyTaskCompletedToCreator({
  projectId,
  taskId,
  newStatusId,
  previousStatusId,
  actorId,
}: {
  projectId: string;
  taskId: string;
  newStatusId: string;
  previousStatusId?: string | null;
  actorId: string;
}) {
  if (!newStatusId || previousStatusId === newStatusId) return;

  try {
    const { createClient, createAdminClient } = await import("./supabase/server");
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const reader = adminClient ?? supabase;

    const statusIds = previousStatusId ? [newStatusId, previousStatusId] : [newStatusId];
    const [{ data: statuses }, { data: task }, { data: project }] = await Promise.all([
      reader.from("project_statuses").select("id, name, category").in("id", statusIds),
      reader
        .from("tasks")
        .select("id, generated_key, title, priority, created_by")
        .eq("id", taskId)
        .maybeSingle(),
      reader.from("projects").select("name").eq("id", projectId).maybeSingle(),
    ]);

    const newStatus = (statuses ?? []).find((s) => s.id === newStatusId);
    const prevStatus = previousStatusId ? (statuses ?? []).find((s) => s.id === previousStatusId) : null;

    if (!newStatus || !isCompletedStatusNameOrCategory(newStatus.category, newStatus.name)) {
      return;
    }
    if (prevStatus && isCompletedStatusNameOrCategory(prevStatus.category, prevStatus.name)) {
      return;
    }
    if (!task?.created_by) return;

    const contacts = await resolveRecipientContacts(
      supabase,
      adminClient,
      [task.created_by, actorId]
    );
    const creator = contacts.find((c) => c.id === task.created_by);
    const actor = contacts.find((c) => c.id === actorId);
    const actorName = actor?.display_name?.trim() || actor?.email || "A teammate";

    if (creator?.email) {
      await sendTaskCompletedEmail({
        recipientEmail: creator.email,
        recipientName: creator.display_name?.trim() || creator.email,
        completedByName: actorName,
        completedBySelf: task.created_by === actorId,
        taskTitle: task.title,
        taskKey: task.generated_key || "TASK",
        taskId: task.id,
        projectName: project?.name || "Project",
        projectId,
        statusName: newStatus.name,
        priority: task.priority || "normal",
      });
    }

    if (task.created_by !== actorId) {
      try {
        await reader.from("notifications").insert({
          recipient_id: task.created_by,
          actor_id: actorId,
          project_id: projectId,
          task_id: task.id,
          event_type: "task_completed",
          message: `${actorName} completed "${task.title}" (${newStatus.name})`,
        });
      } catch (notifErr) {
        console.warn("Could not insert completion notification:", notifErr);
      }
    }
  } catch (err) {
    console.error("Error sending task completion notification:", err);
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
    const { createClient, createAdminClient } = await import("./supabase/server");
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const reader = adminClient ?? supabase;

    const { data: task } = await reader
      .from("tasks")
      .select("id, generated_key, title, project_id")
      .eq("id", taskId)
      .maybeSingle();

    if (!task) return;

    const { candidateUserIds, projectName } = await resolveProjectCandidateUserIds(
      reader,
      projectId,
      authorId
    );
    if (candidateUserIds.length === 0) return;

    const [authorContacts, memberContacts] = await Promise.all([
      resolveRecipientContacts(supabase, adminClient, [authorId]),
      resolveRecipientContacts(supabase, adminClient, candidateUserIds),
    ]);

    const author = authorContacts[0];
    const authorName = author?.display_name?.trim() || author?.email || "A teammate";
    const mentioned = findMentionedContacts(commentBody, memberContacts);

    await Promise.allSettled(
      mentioned
        .filter((r) => r.email)
        .map((recipient) =>
          sendUserMentionedEmail({
            recipientEmail: recipient.email,
            recipientName: recipient.display_name?.trim() || recipient.email,
            authorName,
            taskTitle: task.title,
            taskKey: task.generated_key,
            taskId: task.id,
            projectName,
            projectId,
            commentBody,
          })
        )
    );
  } catch (err) {
    console.error("Error notifying mentioned users:", err);
  }
}

/**
 * Alert & email team members mentioned in a Project Team Channel post.
 */
export async function notifyChannelMentionedUsers({
  projectId,
  postBody,
  explicitMentionIds,
  authorId,
}: {
  projectId: string;
  postBody: string;
  explicitMentionIds?: string[];
  authorId: string;
}): Promise<string[]> {
  try {
    const { createClient, createAdminClient } = await import("./supabase/server");
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const reader = adminClient ?? supabase;

    const { candidateUserIds, projectName } = await resolveProjectCandidateUserIds(
      reader,
      projectId,
      authorId
    );
    if (candidateUserIds.length === 0) return [];

    const [authorContacts, memberContacts] = await Promise.all([
      resolveRecipientContacts(supabase, adminClient, [authorId]),
      resolveRecipientContacts(supabase, adminClient, candidateUserIds),
    ]);

    const author = authorContacts[0];
    const authorName = author?.display_name?.trim() || author?.email || "A teammate";
    const mentioned = findMentionedContacts(postBody, memberContacts, explicitMentionIds);
    if (mentioned.length === 0) return [];

    const notifRows = mentioned.map((recipient) => ({
      recipient_id: recipient.id,
      actor_id: authorId,
      project_id: projectId,
      task_id: null,
      event_type: "channel_mentioned",
      message: `${authorName} mentioned you in ${projectName} channel: "${(postBody || "Shared an update").replace(/\s+/g, " ").slice(0, 110)}"`,
    }));

    try {
      await reader.from("notifications").insert(notifRows);
    } catch (notifErr) {
      console.warn("Channel mention in-app notification warning:", notifErr);
    }

    await Promise.allSettled(
      mentioned
        .filter((r) => r.email)
        .map((recipient) =>
          sendChannelMentionEmail({
            recipientEmail: recipient.email,
            recipientName: recipient.display_name?.trim() || recipient.email,
            authorName,
            projectName,
            projectId,
            postBody,
          })
        )
    );

    return mentioned.map((m) => m.id);
  } catch (err) {
    console.error("Error notifying channel mentioned users:", err);
    return [];
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

export interface OrganizationInvitationEmailParams {
  recipientEmail: string;
  inviterName: string;
  organizationName: string;
  acceptUrl: string;
}

/**
 * Send organization workspace invitation directly via reliable SMTP.
 */
export async function sendOrganizationInvitationEmail(params: OrganizationInvitationEmailParams) {
  const subject = `You've been invited to join ${params.organizationName} on Orbitwork`;

  const html = emailWrapper(`
    <p>Hi,</p>
    <p><strong>${params.inviterName}</strong> has invited you to join <strong>${params.organizationName}</strong> on Orbitwork.</p>

    <div class="card" style="border-left:4px solid #16a34a;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;">
      <div style="font-size:16px;font-weight:700;color:#15803d;margin-bottom:8px;">Workspace Invitation</div>
      <p style="font-size:13px;color:#166534;margin:0 0 14px;">Click the button below to accept the invitation and access the workspace.</p>

      <a href="${params.acceptUrl}" class="btn" style="background:#16a34a;color:#ffffff;display:inline-block;padding:9px 18px;text-decoration:none;border-radius:6px;font-weight:600;">Accept Invitation</a>
    </div>

    <p style="font-size:12px;color:#64748b;">If the button does not work, copy and paste this link into your browser:<br/><a href="${params.acceptUrl}" style="color:#2563eb;">${params.acceptUrl}</a></p>
  `, subject);

  return sendEmail({
    to: params.recipientEmail,
    subject,
    html,
  });
}
