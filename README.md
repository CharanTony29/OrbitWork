# Orbitwork

A free-first, multi-tenant project and work management platform. It now includes core project/task management, multiple task views, time logging, notifications, and basic project documents. Advanced collaboration and external integrations remain in progress.

## Stack

- Next.js 15, React 19, and TypeScript
- Supabase Auth and PostgreSQL with Row Level Security
- Supabase local CLI migrations
- Lucide icons; custom CSS and native form controls

No paid service is enabled. Google Drive support is optional and requires OAuth credentials.

## Local setup

1. Install Node.js 20+ and pnpm 9+.
2. Create a Supabase project on the free tier, or start a local Supabase stack with the Supabase CLI.
3. Copy `.env.example` to `.env.local` and set the project URL and anon key.
4. Apply migrations not yet run in numeric order in the Supabase SQL editor: `202610300001_foundation.sql` through `202610300014_invitation_acceptance.sql`. If earlier migrations were already applied, do not rerun them; apply only the later files. The user reported migration 004 was applied. Migration 014 adds secure invitation acceptance and is required for external member invitations.
5. In Supabase Auth settings, configure the local site URL as `http://localhost:3000` and allow redirects to `http://localhost:3000/auth/callback` (including the recovery query string).
6. Configure the Auth email provider. Supabase's built-in email sender is for low-volume evaluation; production delivery may require an existing SMTP account or paid email service.
7. Run `pnpm install`, then `pnpm dev` and open `http://localhost:3000`. `pnpm test`, `pnpm typecheck`, and `pnpm lint` run the local unit checks.

Email verification should remain enabled. Signup creates an account and sends a verification link; a verified user can sign in, create an organization, then add workspaces. The database creates the initial owner membership atomically through the `create_organization` RPC.

## Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (legacy anon key is also accepted); safe for browser use when RLS is configured correctly |
| `NEXT_PUBLIC_APP_URL` | Optional public app URL for auth links; defaults to localhost |
| `GOOGLE_CLIENT_ID` | Optional server-only Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Optional server-only Google OAuth secret |
| `GOOGLE_REDIRECT_URI` | Optional exact callback URI: `/api/integrations/google-drive/callback` |
| `GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY` | Optional base64 encoding of 32 random bytes; encrypts stored Drive refresh tokens |

Never put the Supabase service-role key or Google credentials in a `NEXT_PUBLIC_*` variable or browser code. The app does not need a service-role key.

## Database and security

The migrations create profiles, organizations, memberships, workspaces, projects, task workflows, tasks/comments/custom fields/relationships, attachment metadata, time entries and timesheets, in-app notifications and project activity, project documents/versions, organization holidays, leave requests, encrypted Google Drive connection records, and a one-time invitation acceptance function. Tenant tables use RLS; sensitive review actions use authenticated database functions. Organization creation runs as a single database function so the creator cannot end up without the initial owner membership.

The initial permission helper is a scaffold for later module-specific permissions. Workspace access comes from organization owner/admin rights or explicit workspace membership. Project access is scoped to its workspace and project memberships; task write access excludes viewers.

## Current scope

**Implemented:** email/password auth, project member/workflow editors, tasks/custom fields, subtasks/dependencies/checklists, list/board/calendar/timeline/workload views, server-side filters and CSV export, time tracking and weekly timesheet submission/review, holidays and leave request/review, in-app task notifications and activity history, Markdown project documents with version history/export, optional Google OAuth and encrypted token storage, Drive attachment upload/download proxy, health endpoint, security headers, and unit tests.

**Next:** collaborative block documents, shared image storage, document-level sharing, workspace/organization editing, granular custom roles, capacity settings, email notifications/reminders, global search and saved filters, richer reports, stronger RLS/integration/browser tests, and production deployment/runbooks.

This is an incremental build, not yet a complete production platform. Google Drive support is coded but cannot connect until its server variables are configured. The document editor uses Markdown with formatting controls; pasted images are stored inline in the document, and PDF downloads include their alt-text placeholder. No paid service, billing, production SMTP, or deployment has been configured. See [deployment and operations](docs/DEPLOYMENT.md).

## Free-tier cost notes

- Supabase Free is $0 within its current quotas, but includes limited database and file storage and may pause inactive projects. Production backups, availability, and higher quotas may require a paid plan.
- Hosting needs a separate decision. Vercel Hobby is free for personal use; do not assume it is appropriate for commercial organizational use. Cloudflare and other providers have free quotas and limitations that should be checked before deployment.
- Google Drive API calls have quotas, and file storage uses the connected Google account's capacity. Google OAuth configuration and review requirements may apply.
- Transactional email at production volume can require an existing mail account or a paid provider. No provider is configured here.

Recheck provider terms, quotas, and prices before deployment; they can change. No paid service should be enabled without approval.
# OrbitWork
