import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type OAuthState = {
  workspaceId?: string;
  organizationId: string;
  userId: string;
  nonce: string;
  issuedAt: number;
  redirectUri?: string;
};

function failure(request: Request, organizationId: string, reason: string, workspaceId?: string) {
  if (workspaceId && /^[0-9a-f-]{36}$/i.test(workspaceId)) {
    return NextResponse.redirect(
      new URL(`/workspaces/${workspaceId}?storage=${encodeURIComponent(reason)}`, request.url)
    );
  }
  const target =
    organizationId && /^[0-9a-f-]{36}$/i.test(organizationId)
      ? `/organizations/${organizationId}/integrations`
      : "/dashboard";
  return NextResponse.redirect(new URL(`${target}?storage=${encodeURIComponent(reason)}`, request.url));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");
  const [payload, signature] = state.split(".");
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  let decoded: OAuthState | null = null;

  if (payload && signature && clientSecret) {
    try {
      const expected = createHmac("sha256", clientSecret).update(payload).digest();
      const received = Buffer.from(signature, "base64url");
      if (expected.length === received.length && timingSafeEqual(expected, received)) {
        decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthState;
      }
    } catch {
      decoded = null;
    }
  }

  const cookieStore = await cookies();
  const nonceCookie = cookieStore.get("orbitwork_onedrive_oauth_nonce")?.value;
  cookieStore.set("orbitwork_onedrive_oauth_nonce", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    path: "/api/integrations/onedrive/callback",
    maxAge: 0,
  });

  const orgId = decoded?.organizationId ?? "";
  const wsId = decoded?.workspaceId ?? "";

  if (
    !decoded ||
    !nonceCookie ||
    decoded.nonce !== nonceCookie ||
    Date.now() - decoded.issuedAt > 600000 ||
    Date.now() < decoded.issuedAt - 30000
  ) {
    return failure(request, orgId, "invalid_state", wsId);
  }
  if (oauthError || !code) {
    return failure(request, orgId, "cancelled", wsId);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== decoded.userId) {
    return failure(request, orgId, "session_changed", wsId);
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const origin = new URL(request.url).origin;
  const redirectUri =
    decoded?.redirectUri ||
    process.env.MICROSOFT_REDIRECT_URI ||
    `${origin}/api/integrations/onedrive/callback`;

  try {
    const tokenResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId || "",
        client_secret: clientSecret || "",
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });

    if (!tokenResponse.ok) return failure(request, orgId, "token_exchange_failed", wsId);

    const tokenPayload = (await tokenResponse.json()) as { access_token?: string; refresh_token?: string };

    let accountEmail: string | undefined;
    if (tokenPayload.access_token) {
      try {
        const userRes = await fetch("https://graph.microsoft.com/v1.0/me", {
          headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
        });
        if (userRes.ok) {
          const u = (await userRes.json()) as { userPrincipalName?: string; mail?: string };
          accountEmail = u.mail || u.userPrincipalName;
        }
      } catch {}
    }

    if (wsId) {
      await supabase.from("workspace_storage_configs").upsert(
        {
          workspace_id: wsId,
          organization_id: orgId,
          onedrive_connected: true,
          onedrive_account_email: accountEmail || user.email,
          onedrive_folder: "Orbitwork",
          onedrive_connected_at: new Date().toISOString(),
          active_provider: "onedrive",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id" }
      );
      return NextResponse.redirect(new URL(`/workspaces/${wsId}?storage=onedrive_connected`, request.url));
    }

    await supabase.from("organization_storage_configs").upsert(
      {
        organization_id: orgId,
        onedrive_connected: true,
        onedrive_account_email: accountEmail || user.email,
        onedrive_folder: "Orbitwork",
        onedrive_connected_at: new Date().toISOString(),
        active_provider: "onedrive",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id" }
    );
    return NextResponse.redirect(
      new URL(`/organizations/${orgId}/integrations?storage=onedrive_connected`, request.url)
    );
  } catch {
    return failure(request, orgId, "connection_failed", wsId);
  }
}
