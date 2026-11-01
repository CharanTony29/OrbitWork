# Project status

Updated: 2026-10-30

## Implemented

- [x] Next.js, React, TypeScript, Supabase SSR, email auth and password recovery
- [x] Organizations, workspaces, projects, project membership, and per-project status workflows
- [x] Task creation/editing, primary/secondary assignees, comments, custom fields, subtasks, dependencies, checklists
- [x] List/drag-and-drop board/calendar/timeline/workload views, filtered pagination, project metrics, CSV export
- [x] Status-wise project reports with estimated/actual time totals and safe CSV export
- [x] Task timers/manual time entries; weekly timesheet submission and manager review
- [x] Organization holiday calendar and leave request/approval flow
- [x] In-app task notifications and task activity history
- [x] Markdown project documents with version snapshots, toolbar formatting, pasted/uploaded inline images, HTML and direct PDF download
- [x] Organization and optional workspace invitations by email, with one-time token acceptance
- [x] Multiple organization creation and owner-only deletion with exact-name confirmation
- [x] Persistent dark workspace/project navigation with app rail and organization → workspace → project tree
- [x] Date-spanning calendar/timeline tasks with planned/active/overdue styling, company holidays, and approved colleague leave
- [x] Week/month timesheet selection; managers see project team entries and members see their own
- [x] Optional Google OAuth connection with encrypted refresh token storage; task attachment upload and permission-checked download proxy
- [x] Security headers, health endpoint, and five unit tests for assignment, time rounding, CSV formula injection, and Markdown XSS handling
- [x] TypeScript, ESLint, and unit tests pass on current source

## Partial / pending product work

- Collaborative block editor, image upload to shared storage, document-level sharing and history restore
- Workspace editing/archive/delete/duplicate, organization editing/archive, and granular custom roles
- Configurable dynamic columns, drag-and-drop scheduling, Gantt dependencies/critical path, workload capacity
- Timesheet exports, full month approvals, work calendars and regional holiday rules
- Due-date reminders/email notifications, preferences, digest delivery, global search, saved filters, and broader reports
- Whiteboards/flowcharts, dashboard customization, billing, production SMTP
- Broader RLS adversarial tests, Supabase integration tests, browser/responsive/accessibility tests, production release validation

## Database migrations

Migrations exist through `202610300014_invitation_acceptance.sql`. The user reported migration 004 was applied earlier. Apply only unapplied migrations, in order:

1. `202610300005_primary_secondary_assignees.sql`
2. `202610300006_task_relationships_checklists.sql`
3. `202610300007_time_tracking.sql`
4. `202610300008_notifications.sql`
5. `202610300009_project_documents.sql`
6. `202610300010_timesheets.sql`
7. `202610300011_holidays_leave.sql`
8. `202610300012_project_activity.sql`
9. `202610300013_google_drive_connections.sql`
10. `202610300014_invitation_acceptance.sql`

Do not rerun an applied migration. There is no local Supabase CLI, database URL, or service-role credential available to apply these from the workspace; run the pending SQL files in the Supabase SQL Editor.

## Configuration and costs

- `.env.local` remains git-ignored and currently contains only Supabase URL and publishable key variables.
- Google OAuth is coded but not connected: Google client ID/secret, exact redirect URI, and a 32-byte encryption key are required. Setup instructions are in [deployment guide](docs/DEPLOYMENT.md).
- Supabase Free is the intended starting plan; usage limits, inactivity pausing, and limited backup/storage options apply.
- No paid service, production host, SMTP provider, or domain has been activated.

## Verification limits

- Five local unit tests pass. These do not cover database policies, OAuth, Drive, or user workflows.
- `tsc --noEmit` and ESLint pass.
- `next build` did not produce build output in this environment and was stopped; production build remains unverified.
- Migrations after 004 and Google OAuth have not been confirmed as run against the user's live Supabase/Google accounts. Migration-backed UI requires each pending SQL file in order.
- CSV export caps each request at 50,000 rows; task attachment uploads are capped at 15 MB.
