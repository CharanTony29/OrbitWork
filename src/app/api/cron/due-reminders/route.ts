import { NextResponse } from "next/server";
import { checkAndSendDueDateReminders } from "@/lib/email";
import { createClient, getAuthUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Validates that the request is authorized either via Vercel Cron Secret (Bearer CRON_SECRET)
 * or via an authenticated manager session.
 */
async function isAuthorizedCronRequest(request: Request, targetProjectId?: string): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  // 1. Authorize via CRON_SECRET Bearer token
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // In non-production environments without CRON_SECRET configured, permit for local testing
  if (process.env.NODE_ENV !== "production" && !cronSecret) {
    return true;
  }

  // 2. Authorize via authenticated user with project management permissions
  try {
    const {
      data: { user },
    } = await getAuthUser();

    if (user) {
      if (!targetProjectId) {
        return true;
      }
      const supabase = await createClient();
      const { data: canManage } = await supabase.rpc("can_manage_project", {
        project_id: targetProjectId,
      });
      if (canManage) {
        return true;
      }
    }
  } catch {
    // Non-blocking fallback
  }

  return false;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") || undefined;

  const authorized = await isAuthorizedCronRequest(request, projectId);
  if (!authorized) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing authorization credentials." },
      { status: 401 }
    );
  }

  const result = await checkAndSendDueDateReminders(projectId);
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const projectId = body?.projectId || undefined;

  const authorized = await isAuthorizedCronRequest(request, projectId);
  if (!authorized) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing authorization credentials." },
      { status: 401 }
    );
  }

  const result = await checkAndSendDueDateReminders(projectId);
  return NextResponse.json(result);
}
