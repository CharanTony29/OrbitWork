import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptOneDriveToken } from "@/lib/onedrive";

type OAuthState = {
  workspaceId?: string;
  organizationId: string;
  userId: string;
  nonce: string;
  issuedAt: number;
  redirectUri?: string;
};

function failure(request: Request, organizationId: string, reason: string, workspaceId?: string, detail?: string) {
  const param = `storage=${encodeURIComponent(reason)}${detail ? `&storage_error=${encodeURIComponent(detail)}` : ""}`;
  if (workspaceId && /^[0-9a-f-]{36}$/i.test(workspaceId)) {
    return NextResponse.redirect(
      new URL(`/workspaces/${workspaceId}?${param}`, request.url)
    );
  }
  const target =
    organizationId && /^[0-9a-f-]{36}$/i.test(organizationId)
      ? `/organizations/${organizationId}/integrations`
      : "/dashboard";
  return NextResponse.redirect(new URL(`${target}?${param}`, request.url));
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

    let refreshTokenCiphertext: string | null = null;
    if (tokenPayload.refresh_token) {
      try {
        refreshTokenCiphertext = encryptOneDriveToken(tokenPayload.refresh_token);
      } catch (encErr) {
        console.error("Failed encrypting OneDrive refresh token:", encErr);
      }
    }

    if (wsId) {
      const { data: existing } = await supabase
        .from("workspace_storage_configs")
        .select("workspace_id, onedrive_folder")
        .eq("workspace_id", wsId)
        .maybeSingle();

      const wsData: Record<string, unknown> = {
        organization_id: orgId,
        onedrive_connected: true,
        onedrive_account_email: accountEmail || user.email,
        onedrive_folder: existing?.onedrive_folder || "Orbitwork",
        onedrive_connected_at: new Date().toISOString(),
        active_provider: "onedrive",
        updated_at: new Date().toISOString(),
      };
      if (refreshTokenCiphertext) {
        wsData.onedrive_refresh_token_ciphertext = refreshTokenCiphertext;
      }

      let saveErr: any = null;
      if (existing) {
        let { error } = await supabase
          .from("workspace_storage_configs")
          .update(wsData)
          .eq("workspace_id", wsId);
        if (error && (error.message?.includes("onedrive_refresh_token_ciphertext") || error.code === "PGRST204")) {
          delete wsData.onedrive_refresh_token_ciphertext;
          const retry = await supabase
            .from("workspace_storage_configs")
            .update(wsData)
            .eq("workspace_id", wsId);
          error = retry.error;
        }
        saveErr = error;
      } else {
        wsData.workspace_id = wsId;
        let { error } = await supabase.from("workspace_storage_configs").insert(wsData);
        if (error && (error.message?.includes("onedrive_refresh_token_ciphertext") || error.code === "PGRST204")) {
          delete wsData.onedrive_refresh_token_ciphertext;
          const retry = await supabase.from("workspace_storage_configs").insert(wsData);
          error = retry.error;
        }
        saveErr = error;
      }

      if (saveErr) {
        console.error("[OneDrive Callback] Workspace save failed:", saveErr);
        return failure(request, orgId, "save_failed", wsId, saveErr.message);
      }
      return NextResponse.redirect(new URL(`/workspaces/${wsId}?storage=onedrive_connected`, request.url));
    }

    const { data: existingOrg } = await supabase
      .from("organization_storage_configs")
      .select("organization_id, onedrive_folder")
      .eq("organization_id", orgId)
      .maybeSingle();

    const orgData: Record<string, unknown> = {
      onedrive_connected: true,
      onedrive_account_email: accountEmail || user.email,
      onedrive_folder: existingOrg?.onedrive_folder || "Orbitwork",
      onedrive_connected_at: new Date().toISOString(),
      active_provider: "onedrive",
      updated_at: new Date().toISOString(),
    };
    if (refreshTokenCiphertext) {
      orgData.onedrive_refresh_token_ciphertext = refreshTokenCiphertext;
    }

    let saveErr: any = null;
    if (existingOrg) {
      let { error } = await supabase
        .from("organization_storage_configs")
        .update(orgData)
        .eq("organization_id", orgId);
      if (error && (error.message?.includes("onedrive_refresh_token_ciphertext") || error.code === "PGRST204")) {
        delete orgData.onedrive_refresh_token_ciphertext;
        const retry = await supabase
          .from("organization_storage_configs")
          .update(orgData)
          .eq("organization_id", orgId);
        error = retry.error;
      }
      saveErr = error;
    } else {
      orgData.organization_id = orgId;
      let { error } = await supabase.from("organization_storage_configs").insert(orgData);
      if (error && (error.message?.includes("onedrive_refresh_token_ciphertext") || error.code === "PGRST204")) {
        delete orgData.onedrive_refresh_token_ciphertext;
        const retry = await supabase.from("organization_storage_configs").insert(orgData);
        error = retry.error;
      }
      saveErr = error;
    }

    if (saveErr) {
      console.error("[OneDrive Callback] Organization save failed:", saveErr);
      return failure(request, orgId, "save_failed", undefined, saveErr.message);
    }

    return NextResponse.redirect(
      new URL(`/organizations/${orgId}/integrations?storage=onedrive_connected`, request.url)
    );
  } catch {
    return failure(request, orgId, "connection_failed", wsId);
  }
}
