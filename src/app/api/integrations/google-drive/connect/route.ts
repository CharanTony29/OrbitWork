import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/", request.url));

  const urlParams = new URL(request.url).searchParams;
  const workspaceId = urlParams.get("workspaceId") ?? "";
  const organizationId = urlParams.get("organizationId") ?? "";

  let targetOrgId = organizationId;
  let targetWsId = workspaceId;

  // Workspace-level integration (Managers or Owners)
  if (workspaceId) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceId)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    const { data: canManage } = await supabase.rpc("can_manage_workspace", { target_workspace: workspaceId });
    if (!canManage) {
      return NextResponse.redirect(new URL(`/workspaces/${workspaceId}?drive=forbidden`, request.url));
    }
    const { data: ws } = await supabase.from("workspaces").select("id, organization_id, name").eq("id", workspaceId).maybeSingle();
    if (!ws) return NextResponse.redirect(new URL("/dashboard", request.url));
    targetOrgId = ws.organization_id;
    targetWsId = ws.id;
  } else {
    // Organization-level fallback integration (Admins or Owners)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    const { data: canManage } = await supabase.rpc("has_org_role", { target_org: organizationId, allowed_roles: ["owner", "admin"] });
    if (!canManage) {
      return NextResponse.redirect(new URL(`/organizations/${organizationId}/integrations?drive=forbidden`, request.url));
    }
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const origin = new URL(request.url).origin;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${origin}/api/integrations/google-drive/callback`;
  if (!clientId || !clientSecret || !process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY) {
    const errorTarget = targetWsId ? `/workspaces/${targetWsId}?drive=not_configured` : `/organizations/${targetOrgId}/integrations?drive=not_configured`;
    return NextResponse.redirect(new URL(errorTarget, request.url));
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
    prompt: "consent",
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
