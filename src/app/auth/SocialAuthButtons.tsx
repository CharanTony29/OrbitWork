"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function SocialAuthButtons({
  returnUrl = "",
  mode = "signin",
}: {
  returnUrl?: string;
  mode?: "signin" | "signup";
}) {
  const [loadingProvider, setLoadingProvider] = useState<"google" | "azure" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleOAuth = async (provider: "google" | "azure") => {
    try {
      setLoadingProvider(provider);
      setErrorMsg(null);
      const supabase = createClient();
      const origin = window.location.origin;
      const safeNext = returnUrl && returnUrl.startsWith("/") && !returnUrl.startsWith("//") ? returnUrl : "/dashboard";
      const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          queryParams: provider === "google" ? { access_type: "offline", prompt: "consent" } : undefined,
          scopes: provider === "azure" ? "email openid profile" : undefined,
        },
      });

      if (error) {
        console.error(`${provider} OAuth error:`, error);
        setErrorMsg(error.message || `Failed to connect with ${provider === "google" ? "Google" : "Microsoft"}.`);
        setLoadingProvider(null);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(`An unexpected error occurred connecting to ${provider === "google" ? "Google" : "Microsoft"}.`);
      setLoadingProvider(null);
    }
  };

  const verb = mode === "signup" ? "Sign up" : "Continue";

  return (
    <div style={{ margin: "4px 0 16px" }}>
      {errorMsg && (
        <div className="error" role="alert" style={{ margin: "0 0 12px 0", fontSize: "12px", padding: "8px 12px" }}>
          {errorMsg}
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {/* Google Button */}
        <button
          type="button"
          onClick={() => handleOAuth("google")}
          disabled={loadingProvider !== null}
          className="button button-secondary auth-social-btn"
          style={{
            width: "100%",
            height: 42,
            border: "1px solid var(--line, #dfe5e0)",
            background: "#ffffff",
            color: "var(--ink, #17231f)",
            fontSize: 13,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            borderRadius: 8,
            cursor: loadingProvider ? "not-allowed" : "pointer",
            transition: "all 0.15s ease",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          {loadingProvider === "google" ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>{loadingProvider === "google" ? "Connecting to Google…" : `${verb} with Google`}</span>
        </button>

        {/* Microsoft Button */}
        <button
          type="button"
          onClick={() => handleOAuth("azure")}
          disabled={loadingProvider !== null}
          className="button button-secondary auth-social-btn"
          style={{
            width: "100%",
            height: 42,
            border: "1px solid var(--line, #dfe5e0)",
            background: "#ffffff",
            color: "var(--ink, #17231f)",
            fontSize: 13,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            borderRadius: 8,
            cursor: loadingProvider ? "not-allowed" : "pointer",
            transition: "all 0.15s ease",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          {loadingProvider === "azure" ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <svg width="17" height="17" viewBox="0 0 23 23" aria-hidden="true">
              <path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H12z" />
              <path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H12z" />
            </svg>
          )}
          <span>{loadingProvider === "azure" ? "Connecting to Microsoft…" : `${verb} with Microsoft`}</span>
        </button>
      </div>

      {/* Modern Centered Divider */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          margin: "18px 0 14px",
          gap: 12,
        }}
      >
        <div style={{ flex: 1, height: 1, background: "var(--line, #dfe5e0)" }} />
        <span style={{ fontSize: 11, color: "var(--muted, #77827c)", fontWeight: 500, letterSpacing: "0.2px" }}>
          or continue with email
        </span>
        <div style={{ flex: 1, height: 1, background: "var(--line, #dfe5e0)" }} />
      </div>
    </div>
  );
}
