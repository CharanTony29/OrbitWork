import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      try {
        await supabase.rpc("accept_user_pending_invitations");
      } catch {}
      const requested = request.nextUrl.searchParams.get("next");
      const safeNext = requested?.startsWith("/") && !requested.startsWith("//") ? requested : null;
      const destination = request.nextUrl.searchParams.get("type") === "recovery" ? "/auth/reset-password" : safeNext ?? "/dashboard";
      return NextResponse.redirect(new URL(destination, request.url));
    }
  }
  return NextResponse.redirect(new URL("/?error=verification_failed", request.url));
}
