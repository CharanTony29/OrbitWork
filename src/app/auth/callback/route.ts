import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const user = data?.user;
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("approval_status")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.approval_status === "pending") {
          await supabase.auth.signOut();
          return NextResponse.redirect(new URL("/?message=pending_approval", request.url));
        }

        if (profile?.approval_status === "rejected") {
          await supabase.auth.signOut();
          return NextResponse.redirect(new URL("/?error=account_rejected", request.url));
        }
      }

      const requested = request.nextUrl.searchParams.get("next");
      const safeNext = requested?.startsWith("/") && !requested.startsWith("//") ? requested : null;
      const destination = request.nextUrl.searchParams.get("type") === "recovery" ? "/auth/reset-password" : safeNext ?? "/dashboard";
      return NextResponse.redirect(new URL(destination, request.url));
    }
  }
  return NextResponse.redirect(new URL("/?error=verification_failed", request.url));
}
