import { createHmac, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserApplicableOrgPolicies } from "@/lib/personal-cloud";
import { getAuthCookieDomain } from "@/lib/subdomain";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  // Pre-check org allowed provider policy before redirecting to Google OAuth
  const policies = await getUserApplicableOrgPolicies(supabase, user.id);
  const blockedOrg = policies.find((p) => p.allowedProviders === "onedrive");
  if (blockedOrg) {
    return NextResponse.redirect(
      new URL(
        `/profile?cloud_error=policy_violation&cloud_detail=${encodeURIComponent(
          `${blockedOrg.organizationName} only allows Microsoft OneDrive for chat & group attachments.`
        )}`,
        request.url
      )
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const reqUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || reqUrl.protocol.replace(":", "");
  const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : reqUrl.origin;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || `${origin}/api/integrations/google-drive/callback`;

  if (!clientId || !clientSecret || !process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY) {
    return NextResponse.redirect(new URL("/profile?cloud_error=not_configured", origin));
  }

  const nonce = randomBytes(32).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      mode: "user_personal",
      organizationId: "",
      userId: user.id,
      nonce,
      issuedAt: Date.now(),
      redirectUri,
      returnOrigin: origin,
    })
  ).toString("base64url");

  const signature = createHmac("sha256", clientSecret).update(payload).digest("base64url");
  const state = `${payload}.${signature}`;

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email",
    access_type: "offline",
    prompt: "consent select_account",
    include_granted_scopes: "true",
    state,
  }).toString();

  const cookieDomain = getAuthCookieDomain(forwardedHost || reqUrl.hostname);
  const response = NextResponse.redirect(authUrl);
  response.cookies.set("orbitwork_drive_oauth_nonce", nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: forwardedProto === "https",
    path: "/",
    ...(cookieDomain ? { domain: cookieDomain } : {}),
    maxAge: 600,
  });

  return response;
}
