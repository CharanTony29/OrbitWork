# Deployment and operations

This guide prepares the app for deployment without selecting or activating a hosting subscription. Recheck provider quotas, commercial-use terms, data location, backup guarantees, and pricing before choosing a host.

## Required configuration

Set these in the hosting provider's server environment (and the matching local `.env.local` for development):

| Variable | Exposure | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | Yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server | Yes; RLS must be enabled |
| `NEXT_PUBLIC_APP_URL` | Browser and server | Set to the canonical HTTPS app origin |
| `GOOGLE_CLIENT_ID` | Server | Only for Google Drive |
| `GOOGLE_CLIENT_SECRET` | Server secret | Only for Google Drive |
| `GOOGLE_REDIRECT_URI` | Server | Exact OAuth callback URL |
| `GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY` | Server secret | Only for Google Drive; base64 encoding of 32 random bytes |

Never prefix Google credentials or the token encryption key with `NEXT_PUBLIC_`. Keep a protected offline copy of the encryption key; losing it makes stored Drive refresh tokens unusable. Rotating it requires a token re-encryption migration.

## Supabase setup

1. Create a project on the selected plan and configure email verification and password recovery.
2. Apply each migration not already applied, in numeric order, from `supabase/migrations`.
3. Configure the Supabase Auth site URL to the app's canonical URL and allow `${NEXT_PUBLIC_APP_URL}/auth/callback`.
4. Confirm email delivery, recovery links, and user signup in a non-production environment.
5. Keep database backups and export procedures appropriate to the selected plan. The app does not use a service-role key.

## Google Drive OAuth

1. Create an OAuth client in Google Cloud and register the exact `GOOGLE_REDIRECT_URI`.
2. Request only the Drive file scope used by the app. Review consent-screen publishing/test-user restrictions for the account and audience.
3. Generate a key with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` (or `openssl rand -base64 32`), store it as `GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY`, and keep it server-only.
4. Set all four Google variables, restart/redeploy, then connect Drive from the organization Integrations page as an owner or admin.
5. Upload/download tests must confirm that a non-member cannot access an attachment through the app route, even if they know its attachment ID. Google Drive links are not rendered as direct download links in the UI.

The current app stores document text in Postgres. Google Drive is used for task attachment binaries. Rich-text document images, file operations beyond upload/download, and document-specific sharing are not implemented yet.

## Build, release, and rollback

1. Run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` in CI before release.
2. Deploy a preview environment first. Apply additive migrations before deploying code that reads their tables. Keep a backup before any destructive schema change.
3. Run signup/login, organization/workspace/project/task creation, role isolation, Drive upload/download, timesheet submission/review, leave request/review, and recovery-link checks against the preview environment.
4. Promote only after acceptance checks pass. Keep prior application deployments available for rollback; database schema rollbacks should use forward fixes unless the migration is proven unused.
5. Check `/api/health` for process liveness. It does not verify Supabase connectivity.

## Operational limits to monitor

- Supabase database, auth email, and file storage quotas vary by plan and may change. The application currently limits individual Drive task attachments to 15 MB and CSV exports to 50,000 tasks.
- Email notifications, due-date reminders, scheduled jobs, database backup automation, and centralized error reporting are not configured.
- No production host, domain, or paid service has been selected or activated.
