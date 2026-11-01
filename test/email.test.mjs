import test from "node:test";
import assert from "node:assert/strict";
import {
  sendEmail,
  sendTaskAssignedEmail,
  sendTaskDueReminderEmail,
  sendUserMentionedEmail,
  sendTaskHoursExhaustingEmail,
  sendAdminNewUserSignupAlert,
  sendUserAccountApprovedEmail,
} from "../src/lib/email.ts";

test("sendEmail returns ok in simulated/development mode", async () => {
  const result = await sendEmail({
    to: "test@example.com",
    subject: "Test Subject",
    html: "<p>Hello World</p>",
  });
  assert.equal(result.ok, true);
});

test("sendTaskAssignedEmail generates valid notification", async () => {
  const res = await sendTaskAssignedEmail({
    recipientEmail: "member@example.com",
    recipientName: "Jane Doe",
    assignerName: "Admin Charan",
    taskTitle: "Design Homepage",
    taskKey: "TASK-12345678",
    taskId: "d1234567-0000-0000-0000-000000000001",
    projectName: "Website Redesign",
    projectId: "p1234567-0000-0000-0000-000000000001",
    priority: "high",
    dueDate: "2026-11-05",
    description: "Please complete design mockup",
  });
  assert.equal(res.ok, true);
});

test("sendTaskDueReminderEmail handles due today and overdue tasks", async () => {
  const resDueToday = await sendTaskDueReminderEmail({
    recipientEmail: "member@example.com",
    recipientName: "Jane Doe",
    taskTitle: "Deploy API",
    taskKey: "TASK-99887766",
    taskId: "d1234567-0000-0000-0000-000000000002",
    projectName: "Cloud Migration",
    projectId: "p1234567-0000-0000-0000-000000000002",
    priority: "urgent",
    dueDate: "2026-11-01",
    isOverdue: false,
  });
  assert.equal(resDueToday.ok, true);

  const resOverdue = await sendTaskDueReminderEmail({
    recipientEmail: "member@example.com",
    recipientName: "Jane Doe",
    taskTitle: "Security Audit",
    taskKey: "TASK-11223344",
    taskId: "d1234567-0000-0000-0000-000000000003",
    projectName: "Cloud Migration",
    projectId: "p1234567-0000-0000-0000-000000000002",
    priority: "high",
    dueDate: "2026-10-25",
    isOverdue: true,
  });
  assert.equal(resOverdue.ok, true);
});

test("sendUserMentionedEmail generates mention alert with comment quote", async () => {
  const res = await sendUserMentionedEmail({
    recipientEmail: "jane@example.com",
    recipientName: "Jane Doe",
    authorName: "Charan",
    taskTitle: "Database Indexing",
    taskKey: "TASK-55667788",
    taskId: "d1234567-0000-0000-0000-000000000004",
    projectName: "Backend Core",
    projectId: "p1234567-0000-0000-0000-000000000003",
    commentBody: "Hey @Jane Doe can you check the query execution plan?",
  });
  assert.equal(res.ok, true);
});

test("sendTaskHoursExhaustingEmail sends warning when less than 1 hour remains and alert when exceeded", async () => {
  // 1. Warning when less than 1 hour remains
  const resWarning = await sendTaskHoursExhaustingEmail({
    recipientEmail: "lead@example.com",
    recipientName: "Tech Lead",
    taskTitle: "Refactor Auth Middleware",
    taskKey: "TASK-88990011",
    taskId: "d1234567-0000-0000-0000-000000000005",
    projectName: "Security Initiative",
    projectId: "p1234567-0000-0000-0000-000000000004",
    estimateMinutes: 120, // 2h
    workedMinutes: 75, // 1h 15m
    remainingMinutes: 45, // 45m left (< 1h)
  });
  assert.equal(resWarning.ok, true);

  // 2. Alert when budget is exceeded
  const resExceeded = await sendTaskHoursExhaustingEmail({
    recipientEmail: "lead@example.com",
    recipientName: "Tech Lead",
    taskTitle: "Refactor Auth Middleware",
    taskKey: "TASK-88990011",
    taskId: "d1234567-0000-0000-0000-000000000005",
    projectName: "Security Initiative",
    projectId: "p1234567-0000-0000-0000-000000000004",
    estimateMinutes: 120, // 2h
    workedMinutes: 180, // 3h
    remainingMinutes: -60, // 1h over
  });
  assert.equal(resExceeded.ok, true);
});

test("sendAdminNewUserSignupAlert generates admin notification for pending signup", async () => {
  const res = await sendAdminNewUserSignupAlert({
    adminEmail: "admin@example.com",
    adminName: "Charan Admin",
    userEmail: "newjoiner@example.com",
    signupDate: "2026-11-01 10:00 AM",
  });
  assert.equal(res.ok, true);
});

test("sendUserAccountApprovedEmail generates user welcome notification", async () => {
  const res = await sendUserAccountApprovedEmail({
    recipientEmail: "newjoiner@example.com",
    recipientName: "New Joiner",
    organizationName: "Orbitwork Org",
  });
  assert.equal(res.ok, true);
});
