import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getHostInfo, getSubdomainOrigin } from "@/lib/subdomain";

function sanitizeErrorDetail(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/https?:\/\/[a-z0-9-]+\.supabase\.co[^\s]*/gi, "authentication service")
    .replace(/\bsupabase\b/gi, "Orbitwork Auth")
    .slice(0, 200);
}

export async function GET(request: NextRequest) {
  const hostInfo = getHostInfo(request);
  const appOrigin = getSubdomainOrigin("app", hostInfo);

  // If callback lands on www.orbitwork.org or orbitwork.org in production, forward directly to app.orbitwork.org
  // so the request executes in the origin holding the PKCE code verifier cookie.
  if (hostInfo.isProduction && hostInfo.kind !== "app") {
    const targetUrl = new URL(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
      "https://app.orbitwork.org"
    );
    return NextResponse.redirect(targetUrl, 307);
  }

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

  // 1. Handle error reported directly by Auth provider
  if (error) {
    console.warn("[Auth Callback] Received error from Auth provider:", { error, errorDesc, isRecovery });
    if (isRecovery) {
      return NextResponse.redirect(new URL("/reset-password?error=link_expired", appOrigin));
    }
    const detail = sanitizeErrorDetail(errorDesc || error);
    const loginUrl = new URL("/login", appOrigin);
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
      return NextResponse.redirect(new URL(destination, appOrigin));
    } else {
      console.error("[Auth Callback] verifyOtp error:", otpError);
      if (isRecovery) {
        return NextResponse.redirect(new URL("/reset-password?error=link_expired", appOrigin));
      }
      return NextResponse.redirect(new URL("/login?error=verification_failed", appOrigin));
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
      return NextResponse.redirect(new URL(destination, appOrigin));
    } else {
      console.error("[Auth Callback] Exchange code error:", exchangeError);
      if (isRecovery) {
        return NextResponse.redirect(new URL("/reset-password?error=link_expired", appOrigin));
      }

      const rawMsg = exchangeError.message || "";
      const lowerMsg = rawMsg.toLowerCase();
      const isCookieOrPkce =
        lowerMsg.includes("code verifier") ||
        lowerMsg.includes("code_verifier") ||
        lowerMsg.includes("non-empty") ||
        lowerMsg.includes("pkce");

      if (type === "signup" || type === "magiclink" || type === "email") {
        return NextResponse.redirect(new URL("/login?error=verification_failed", appOrigin));
      }

      const loginUrl = new URL("/login", appOrigin);
      loginUrl.searchParams.set("error", isCookieOrPkce ? "oauth_cookie_blocked" : "oauth_failed");
      const detail = sanitizeErrorDetail(rawMsg);
      if (detail) loginUrl.searchParams.set("error_detail", detail);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 4. If recovery is explicitly specified without code or token
  if (isRecovery) {
    return NextResponse.redirect(new URL("/auth/reset-password", appOrigin));
  }

  if (type === "signup" || type === "magiclink" || type === "email") {
    return NextResponse.redirect(new URL("/login?error=verification_failed", appOrigin));
  }

  return NextResponse.redirect(new URL("/login?error=oauth_missing_code", appOrigin));
}
