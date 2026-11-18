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

  // Pre-check org allowed provider policy before redirecting to Microsoft OAuth
  const policies = await getUserApplicableOrgPolicies(supabase, user.id);
  const blockedOrg = policies.find((p) => p.allowedProviders === "google_drive");
  if (blockedOrg) {
    return NextResponse.redirect(
      new URL(
        `/profile?cloud_error=policy_violation&cloud_detail=${encodeURIComponent(
          `${blockedOrg.organizationName} only allows Google Drive for chat & group attachments.`
        )}`,
        request.url
      )
    );
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const origin = new URL(request.url).origin;
  const redirectUri =
    process.env.MICROSOFT_REDIRECT_URI || `${origin}/api/integrations/onedrive/callback`;

  if (!clientId || !clientSecret) {
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

  const authUrl = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  authUrl.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    prompt: "select_account",
    scope: "Files.ReadWrite offline_access User.Read",
    state,
  }).toString();

  const cookieStore = await cookies();
  cookieStore.set("orbitwork_onedrive_oauth_nonce", nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/api/integrations/onedrive/callback",
    maxAge: 600,
  });

  return NextResponse.redirect(authUrl);
}
