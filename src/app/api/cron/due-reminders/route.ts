import { NextResponse } from "next/server";
import { checkAndSendDueDateReminders } from "@/lib/email";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") || undefined;

  const result = await checkAndSendDueDateReminders(projectId);
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const projectId = body?.projectId || undefined;

  const result = await checkAndSendDueDateReminders(projectId);
  return NextResponse.json(result);
}
