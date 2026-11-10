"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Listens for Supabase password recovery tokens and hash fragments across all pages.
 * If a user clicks a reset password email link that lands on the home page or any other route,
 * this component immediately redirects them to /auth/reset-password.
 */
export default function AuthRecoveryListener() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const pathname = window.location.pathname;

    // 1. Check window.location.hash for implicit flow tokens
    const hash = window.location.hash;
    if (hash && hash.length > 1) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const type = hashParams.get("type");
      const accessToken = hashParams.get("access_token");
      const error = hashParams.get("error");
      const errorDesc = hashParams.get("error_description");

      if (type === "recovery" || (accessToken && hash.includes("type=recovery"))) {
        if (pathname !== "/auth/reset-password") {
          window.location.replace(`/auth/reset-password${hash}`);
          return;
        }
      }

      if (error && (type === "recovery" || hash.includes("recovery") || hash.includes("password"))) {
        if (pathname !== "/reset-password") {
          window.location.replace("/reset-password?error=link_expired");
          return;
        }
      }
    }

    // 2. Check window.location.search for PKCE code or recovery query
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code");
    const type = searchParams.get("type");
    const next = searchParams.get("next");

    if (code && (type === "recovery" || next?.includes("reset-password"))) {
      if (pathname === "/" || pathname === "/reset-password") {
        window.location.replace(`/auth/callback${window.location.search}`);
        return;
      }
    }

    if (type === "recovery" && pathname !== "/auth/reset-password") {
      window.location.replace("/auth/reset-password");
      return;
    }

    // 3. Listen to Supabase client auth state change for PASSWORD_RECOVERY event
    try {
      const supabase = createClient();
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          if (window.location.pathname !== "/auth/reset-password") {
            window.location.replace("/auth/reset-password");
          }
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    } catch (err) {
      console.error("[AuthRecoveryListener] Listener initialization error:", err);
    }
  }, []);

  return null;
}
