import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const requestedId = req.nextUrl.searchParams.get("userId");
  const targetUserId = requestedId && UUID_REGEX.test(requestedId) ? requestedId : user.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", targetUserId)
    .maybeSingle();

  const raw = profile?.avatar_url?.trim();
  if (!raw) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (raw.startsWith("data:")) {
    const match = /^data:([^;,]+)(;base64)?,(.*)$/i.exec(raw);
    if (!match) {
      return new NextResponse("Invalid avatar data", { status: 400 });
    }
    const mime = match[1] || "image/png";
    const isBase64 = Boolean(match[2]);
    const payload = match[3] ?? "";
    const bytes = isBase64
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf-8");

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
      },
    });
  }

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return NextResponse.redirect(raw, {
      headers: {
        "Cache-Control": "private, max-age=300",
      },
    });
  }

  return new NextResponse("Unsupported avatar URL", { status: 400 });
}
