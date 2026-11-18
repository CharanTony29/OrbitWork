import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserApplicableOrgPolicies } from "@/lib/personal-cloud";

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
  const origin = new URL(request.url).origin;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || `${origin}/api/integrations/google-drive/callback`;

  if (!clientId || !clientSecret || !process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY) {
    return NextResponse.redirect(new URL("/profile?cloud_error=not_configured", request.url));
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

  const cookieStore = await cookies();
  cookieStore.set("orbitwork_drive_oauth_nonce", nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/api/integrations/google-drive/callback",
    maxAge: 600,
  });

  return NextResponse.redirect(authUrl);
}
