import { createHmac, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthCookieDomain } from "@/lib/subdomain";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/", request.url));

  const urlParams = new URL(request.url).searchParams;
  const workspaceId = urlParams.get("workspaceId") ?? "";
  const organizationId = urlParams.get("organizationId") ?? "";

  let targetOrgId = organizationId;
  let targetWsId = workspaceId;

  if (workspaceId) {
    if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    const { data: canManage } = await supabase.rpc("can_manage_workspace", {
      target_workspace: workspaceId,
    });
    if (!canManage) {
      return NextResponse.redirect(new URL(`/workspaces/${workspaceId}?storage=forbidden`, request.url));
    }
    const { data: ws } = await supabase
      .from("workspaces")
      .select("id, organization_id")
      .eq("id", workspaceId)
      .maybeSingle();
    if (!ws) return NextResponse.redirect(new URL("/dashboard", request.url));
    targetOrgId = ws.organization_id;
    targetWsId = ws.id;
  } else {
    if (!/^[0-9a-f-]{36}$/i.test(organizationId)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    const { data: canManage } = await supabase.rpc("has_org_role", {
      target_org: organizationId,
      allowed_roles: ["owner", "admin"],
    });
    if (!canManage) {
      return NextResponse.redirect(
        new URL(`/organizations/${organizationId}/integrations?storage=forbidden`, request.url)
      );
    }
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const reqUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || reqUrl.protocol.replace(":", "");
  const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : reqUrl.origin;
  const redirectUri =
    process.env.MICROSOFT_REDIRECT_URI || `${origin}/api/integrations/onedrive/callback`;

  // If Azure OAuth isn't configured, redirect back with informative status
  if (!clientId || !clientSecret) {
    const errorTarget = targetWsId
      ? `/workspaces/${targetWsId}?storage=onedrive_credentials_required`
      : `/organizations/${targetOrgId}/integrations?storage=onedrive_credentials_required`;
    return NextResponse.redirect(new URL(errorTarget, origin));
  }

  const nonce = randomBytes(32).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      workspaceId: targetWsId || undefined,
      organizationId: targetOrgId,
      userId: user.id,
      nonce,
      issuedAt: Date.now(),
      redirectUri,
      returnOrigin: origin,
    })
  ).toString("base64url");

  const signature = createHmac("sha256", clientSecret).update(payload).digest("base64url");
  const state = `${payload}.${signature}`;

  const tenant = urlParams.get("tenantId") || "common";
  const authUrl = new URL(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`);
  authUrl.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: "Files.ReadWrite Files.ReadWrite.All offline_access User.Read",
    state,
  }).toString();

  const cookieDomain = getAuthCookieDomain(forwardedHost || reqUrl.hostname);
  const response = NextResponse.redirect(authUrl);
  response.cookies.set("orbitwork_onedrive_oauth_nonce", nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: forwardedProto === "https",
    path: "/",
    ...(cookieDomain ? { domain: cookieDomain } : {}),
    maxAge: 600,
  });

  return response;
}
