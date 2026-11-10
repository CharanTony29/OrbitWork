import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const requested = request.nextUrl.searchParams.get("next");
  const error = request.nextUrl.searchParams.get("error");
  const errorDesc = request.nextUrl.searchParams.get("error_description");

  const safeNext = requested?.startsWith("/") && !requested.startsWith("//") ? requested : null;
  const isRecovery =
    type === "recovery" ||
    safeNext?.includes("reset-password") ||
    errorDesc?.toLowerCase().includes("recovery") ||
    errorDesc?.toLowerCase().includes("password");

  // 1. Handle error reported directly by Supabase
  if (error) {
    console.warn("[Auth Callback] Received error from Supabase:", { error, errorDesc, isRecovery });
    if (isRecovery) {
      return NextResponse.redirect(new URL("/reset-password?error=link_expired", request.url));
    }
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorDesc || error)}`, request.url));
  }

  const supabase = await createClient();

  // 2. Handle token_hash verification (OTP direct token flow)
  if (token_hash) {
    const otpType: EmailOtpType = (type as EmailOtpType) || (isRecovery ? "recovery" : "email");
    const { error: otpError } = await supabase.auth.verifyOtp({ token_hash, type: otpType });

    if (!otpError) {
      try {
        await supabase.rpc("accept_user_pending_invitations");
      } catch {}
      const destination = isRecovery ? "/auth/reset-password" : safeNext ?? "/dashboard";
      return NextResponse.redirect(new URL(destination, request.url));
    } else {
      console.error("[Auth Callback] verifyOtp error:", otpError);
      if (isRecovery) {
        return NextResponse.redirect(new URL("/reset-password?error=link_expired", request.url));
      }
      return NextResponse.redirect(new URL("/login?error=verification_failed", request.url));
    }
  }

  // 3. Handle PKCE code exchange
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (!exchangeError) {
      try {
        await supabase.rpc("accept_user_pending_invitations");
      } catch {}

      const destination = isRecovery ? "/auth/reset-password" : safeNext ?? "/dashboard";
      return NextResponse.redirect(new URL(destination, request.url));
    } else {
      console.error("[Auth Callback] Exchange code error:", exchangeError);
      if (isRecovery) {
        return NextResponse.redirect(new URL("/reset-password?error=link_expired", request.url));
      }
    }
  }

  // 4. If recovery is explicitly specified without code or token
  if (isRecovery) {
    return NextResponse.redirect(new URL("/auth/reset-password", request.url));
  }

  return NextResponse.redirect(new URL("/login?error=verification_failed", request.url));
}
