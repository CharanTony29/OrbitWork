import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptRefreshToken } from "@/lib/google-drive";

type OAuthState = {
  workspaceId?: string;
  organizationId: string;
  userId: string;
  nonce: string;
  issuedAt: number;
  redirectUri?: string;
};

function failure(request: Request, organizationId: string, reason: string, workspaceId?: string, errorDetail?: string) {
  const detailParam = errorDetail ? `&drive_error=${encodeURIComponent(errorDetail)}` : "";
  if (workspaceId && /^[0-9a-f-]{36}$/i.test(workspaceId)) {
    return NextResponse.redirect(new URL(`/workspaces/${workspaceId}?drive=${encodeURIComponent(reason)}${detailParam}`, request.url));
  }
  const target = organizationId && /^[0-9a-f-]{36}$/i.test(organizationId) ? `/organizations/${organizationId}/integrations` : "/dashboard";
  return NextResponse.redirect(new URL(`${target}?drive=${encodeURIComponent(reason)}${detailParam}`, request.url));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");
  const [payload, signature] = state.split(".");
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
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
  const nonceCookie = cookieStore.get("orbitwork_drive_oauth_nonce")?.value;
  cookieStore.set("orbitwork_drive_oauth_nonce", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    path: "/api/integrations/google-drive/callback",
    maxAge: 0,
  });

  const orgId = decoded?.organizationId ?? "";
  const wsId = decoded?.workspaceId ?? "";

  if (!decoded || !nonceCookie || decoded.nonce !== nonceCookie || Date.now() - decoded.issuedAt > 600000 || Date.now() < decoded.issuedAt - 30000) {
    return failure(request, orgId, "invalid_state", wsId);
  }
  if (oauthError || !code) {
    return failure(request, orgId, "cancelled", wsId);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== decoded.userId) {
    return failure(request, orgId, "session_changed", wsId);
  }

  // Permission check: Workspace Managers/Admins/Owners vs Organization Admins/Owners
  if (wsId) {
    const { data: canManage } = await supabase.rpc("can_manage_workspace", { target_workspace: wsId });
    if (!canManage) return failure(request, orgId, "forbidden", wsId);
  } else {
    const { data: canManage } = await supabase.rpc("has_org_role", { target_org: orgId, allowed_roles: ["owner", "admin"] });
    if (!canManage) return failure(request, orgId, "forbidden");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const origin = new URL(request.url).origin;
  const redirectUri = decoded?.redirectUri || process.env.GOOGLE_REDIRECT_URI || `${origin}/api/integrations/google-drive/callback`;
  if (!clientId || !clientSecret || !process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY) {
    return failure(request, orgId, "not_configured", wsId);
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });

    if (!tokenResponse.ok) return failure(request, orgId, "token_exchange_failed", wsId);
    const tokenPayload = (await tokenResponse.json()) as { access_token?: string; refresh_token?: string };

    // Fetch connected Google Account email
    let accountEmail: string | undefined;
    if (tokenPayload.access_token) {
      try {
        const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
          cache: "no-store",
        });
        if (userInfoRes.ok) {
          const info = (await userInfoRes.json()) as { email?: string };
          accountEmail = info.email;
        }
      } catch {}
    }

    let refreshToken = tokenPayload.refresh_token;

    // Handle Workspace-Level Storage Connection
    if (wsId) {
      const { data: existing } = await supabase
        .from("google_drive_connections")
        .select("id, refresh_token_ciphertext")
        .eq("workspace_id", wsId)
        .maybeSingle();

      if (!refreshToken) {
        if (!existing) {
          console.error("[Google Drive Callback] Missing refresh token and no existing workspace connection found:", wsId);
          return failure(request, orgId, "missing_refresh_token", wsId);
        }
        const { error } = await supabase
          .from("google_drive_connections")
          .update({
            connected_by: user.id,
            account_email: accountEmail || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (error) {
          console.error("[Google Drive Callback] Workspace connection update failed:", error);
          return failure(request, orgId, "save_failed", wsId, error.message);
        }
      } else {
        const encrypted = encryptRefreshToken(refreshToken);
        let saveError: any = null;

        if (existing) {
          const { error } = await supabase
            .from("google_drive_connections")
            .update({
              connected_by: user.id,
              refresh_token_ciphertext: encrypted,
              account_email: accountEmail || null,
              token_key_version: 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
          saveError = error;
        } else {
          const { error } = await supabase
            .from("google_drive_connections")
            .insert({
              workspace_id: wsId,
              organization_id: orgId,
              connected_by: user.id,
              refresh_token_ciphertext: encrypted,
              account_email: accountEmail || null,
              token_key_version: 1,
              updated_at: new Date().toISOString(),
            });
          saveError = error;
        }

        if (saveError) {
          console.error("[Google Drive Callback] Workspace connection save failed:", saveError);
          return failure(request, orgId, "save_failed", wsId, saveError.message);
        }
      }
      return NextResponse.redirect(new URL(`/workspaces/${wsId}?drive=connected`, request.url));
    }

    // Handle Organization-Level Fallback Connection
    const { data: existing } = await supabase
      .from("google_drive_connections")
      .select("id, refresh_token_ciphertext")
      .eq("organization_id", orgId)
      .is("workspace_id", null)
      .maybeSingle();

    if (!refreshToken) {
      if (!existing) {
        console.error("[Google Drive Callback] Missing refresh token and no existing org connection found:", orgId);
        return failure(request, orgId, "missing_refresh_token");
      }
      let { error } = await supabase
        .from("google_drive_connections")
        .update({
          connected_by: user.id,
          account_email: accountEmail || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error && (error.message?.includes("account_email") || error.code === "PGRST204")) {
        const { error: retryErr } = await supabase
          .from("google_drive_connections")
          .update({
            connected_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        error = retryErr;
      }

      if (error) {
        console.error("[Google Drive Callback] Org connection update failed:", error);
        return failure(request, orgId, "save_failed", undefined, error.message);
      }
    } else {
      const encrypted = encryptRefreshToken(refreshToken);
      let saveError: any = null;

      if (existing) {
        const { error } = await supabase
          .from("google_drive_connections")
          .update({
            connected_by: user.id,
            refresh_token_ciphertext: encrypted,
            account_email: accountEmail || null,
            token_key_version: 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        saveError = error;
      } else {
        const { error } = await supabase
          .from("google_drive_connections")
          .insert({
            organization_id: orgId,
            workspace_id: null,
            connected_by: user.id,
            refresh_token_ciphertext: encrypted,
            account_email: accountEmail || null,
            token_key_version: 1,
            updated_at: new Date().toISOString(),
          });
        saveError = error;
      }

      // If the error was due to missing new columns on unmigrated Supabase instance, fallback to base columns
      if (saveError && (saveError.message?.includes("account_email") || saveError.message?.includes("workspace_id") || saveError.code === "PGRST204")) {
        console.warn("[Google Drive Callback] Retrying save with base schema (without account_email / workspace_id)...");
        if (existing) {
          const { error: retryErr } = await supabase
            .from("google_drive_connections")
            .update({
              connected_by: user.id,
              refresh_token_ciphertext: encrypted,
              token_key_version: 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
          saveError = retryErr;
        } else {
          const { error: retryErr } = await supabase
            .from("google_drive_connections")
            .insert({
              organization_id: orgId,
              connected_by: user.id,
              refresh_token_ciphertext: encrypted,
              token_key_version: 1,
              updated_at: new Date().toISOString(),
            });
          saveError = retryErr;
        }
      }

      if (saveError) {
        console.error("[Google Drive Callback] Org connection save failed:", saveError);
        return failure(request, orgId, "save_failed", undefined, saveError.message);
      }
    }
    return NextResponse.redirect(new URL(`/organizations/${orgId}/integrations?drive=connected`, request.url));
  } catch (err) {
    console.error("[Google Drive Callback] Unexpected exception:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return failure(request, orgId, "connection_failed", wsId, msg);
  }
}
