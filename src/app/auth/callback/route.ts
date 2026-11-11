import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

function getRedirectOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const requestOrigin = forwardedHost
    ? `${forwardedProto}://${forwardedHost.split(",")[0].trim()}`
    : request.nextUrl.origin;

  const envAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (envAppUrl) {
    try {
      const reqUrl = new URL(requestOrigin);
      const cfgUrl = new URL(envAppUrl);
      if (
        reqUrl.hostname.replace(/^www\./i, "").toLowerCase() ===
        cfgUrl.hostname.replace(/^www\./i, "").toLowerCase()
      ) {
        return cfgUrl.origin;
      }
    } catch {}
  }
  return requestOrigin;
}

function sanitizeErrorDetail(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/https?:\/\/[a-z0-9-]+\.supabase\.co[^\s]*/gi, "authentication service")
    .replace(/\bsupabase\b/gi, "Orbitwork Auth")
    .slice(0, 200);
}

export async function GET(request: NextRequest) {
  const origin = getRedirectOrigin(request);
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

  // 1. Handle error reported directly by OAuth provider or Auth service
  if (error) {
    console.warn("[Auth Callback] Received error from Auth provider:", { error, errorDesc, isRecovery });
    if (isRecovery) {
      return NextResponse.redirect(new URL("/reset-password?error=link_expired", origin));
    }
    const detail = sanitizeErrorDetail(errorDesc || error);
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "oauth_failed");
    if (detail) loginUrl.searchParams.set("error_detail", detail);
    return NextResponse.redirect(loginUrl);
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
      return NextResponse.redirect(new URL(destination, origin));
    } else {
      console.error("[Auth Callback] verifyOtp error:", otpError);
      if (isRecovery) {
        return NextResponse.redirect(new URL("/reset-password?error=link_expired", origin));
      }
      return NextResponse.redirect(new URL("/login?error=verification_failed", origin));
    }
  }

  // 3. Handle PKCE code exchange (OAuth & Email PKCE links)
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (!exchangeError) {
      try {
        await supabase.rpc("accept_user_pending_invitations");
      } catch {}

      const destination = isRecovery ? "/auth/reset-password" : safeNext ?? "/dashboard";
      return NextResponse.redirect(new URL(destination, origin));
    } else {
      console.error("[Auth Callback] Exchange code error:", exchangeError);
      if (isRecovery) {
        return NextResponse.redirect(new URL("/reset-password?error=link_expired", origin));
      }

      const rawMsg = exchangeError.message || "";
      const lowerMsg = rawMsg.toLowerCase();
      const isCookieOrPkce =
        lowerMsg.includes("code verifier") ||
        lowerMsg.includes("code_verifier") ||
        lowerMsg.includes("non-empty") ||
        lowerMsg.includes("pkce");

      if (type === "signup" || type === "magiclink" || type === "email") {
        return NextResponse.redirect(new URL("/login?error=verification_failed", origin));
      }

      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("error", isCookieOrPkce ? "oauth_cookie_blocked" : "oauth_failed");
      const detail = sanitizeErrorDetail(rawMsg);
      if (detail) loginUrl.searchParams.set("error_detail", detail);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 4. If recovery is explicitly specified without code or token
  if (isRecovery) {
    return NextResponse.redirect(new URL("/auth/reset-password", origin));
  }

  if (type === "signup" || type === "magiclink" || type === "email") {
    return NextResponse.redirect(new URL("/login?error=verification_failed", origin));
  }

  return NextResponse.redirect(new URL("/login?error=oauth_missing_code", origin));
}
