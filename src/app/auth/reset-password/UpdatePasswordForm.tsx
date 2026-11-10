"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PasswordInput from "@/app/PasswordInput";
import { createClient } from "@/lib/supabase/client";

type SessionStatus = "checking" | "valid" | "invalid";

export default function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("checking");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      try {
        const supabase = createClient();

        // 1. Check for error in hash fragment (e.g. #error=access_denied&error_description=...)
        const hash = window.location.hash;
        if (hash && hash.length > 1) {
          const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
          const hashError = hashParams.get("error");
          const hashErrorDesc = hashParams.get("error_description");

          if (hashError) {
            if (!isMounted) return;
            const cleanDesc = hashErrorDesc
              ? decodeURIComponent(hashErrorDesc.replace(/\+/g, " "))
              : "This recovery link is invalid or has expired.";
            setErrorMessage(cleanDesc);
            setSessionStatus("invalid");
            return;
          }

          const access_token = hashParams.get("access_token");
          const refresh_token = hashParams.get("refresh_token");

          if (access_token && refresh_token) {
            const { data, error: sessionError } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });

            if (!isMounted) return;

            if (sessionError) {
              console.error("[ResetPassword] setSession error:", sessionError);
              setErrorMessage("This recovery link has expired or has already been used.");
              setSessionStatus("invalid");
              return;
            }

            if (data?.session) {
              setSessionStatus("valid");
              setErrorMessage(null);
              return;
            }
          }
        }

        // 2. Check for error or code in query params (?error=... or ?code=...)
        const searchParams = new URLSearchParams(window.location.search);
        const queryError = searchParams.get("error");
        const queryErrorDesc = searchParams.get("error_description");

        if (queryError) {
          if (!isMounted) return;
          const cleanDesc = queryErrorDesc
            ? decodeURIComponent(queryErrorDesc.replace(/\+/g, " "))
            : "This recovery link is invalid or has expired.";
          setErrorMessage(cleanDesc);
          setSessionStatus("invalid");
          return;
        }

        const code = searchParams.get("code");
        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (!isMounted) return;

          if (exchangeError) {
            console.error("[ResetPassword] exchangeCode error:", exchangeError);
            setErrorMessage("That reset link is invalid or has expired.");
            setSessionStatus("invalid");
            return;
          }

          if (data?.session) {
            setSessionStatus("valid");
            setErrorMessage(null);
            return;
          }
        }

        // 3. Check if session already exists from cookie / earlier exchange
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (session) {
          setSessionStatus("valid");
          setErrorMessage(null);
          return;
        }

        // 4. If neither tokens nor session exist, link is missing or session expired
        setErrorMessage("No active recovery session found. Please click the reset link sent to your email or request a fresh one.");
        setSessionStatus("invalid");
      } catch (err: any) {
        if (!isMounted) return;
        console.error("[ResetPassword] Session init exception:", err);
        setErrorMessage("Unable to verify reset link. Please request a new one.");
        setSessionStatus("invalid");
      }
    }

    initSession();

    // Listen for auth state changes (e.g. if Supabase SDK processes hash in background)
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) {
        setSessionStatus("valid");
        setErrorMessage(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedPassword = password.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (trimmedPassword.length < 8) {
      setErrorMessage("Your new password must be at least 8 characters long.");
      return;
    }

    if (trimmedPassword.length > 128) {
      setErrorMessage("Your password cannot exceed 128 characters.");
      return;
    }

    if (trimmedPassword !== trimmedConfirm) {
      setErrorMessage("Passwords do not match. Please re-enter to confirm.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();

      // Ensure session is active
      let session = (await supabase.auth.getSession()).data.session;

      // Fallback: re-try session extraction from hash if not present in memory
      if (!session && typeof window !== "undefined" && window.location.hash) {
        const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        if (access_token && refresh_token) {
          const res = await supabase.auth.setSession({ access_token, refresh_token });
          session = res.data.session;
        }
      }

      if (!session) {
        setErrorMessage("Your recovery session is no longer active. Please request a new password reset link.");
        setSessionStatus("invalid");
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: trimmedPassword });

      if (error) {
        console.error("[ResetPassword] updateUser error:", error);
        setErrorMessage(error.message);
        setIsSubmitting(false);
        return;
      }

      setSuccess(true);

      // Sign out to enforce clean sign-in with the new credentials
      try {
        await supabase.auth.signOut();
      } catch {}

      window.location.href = "/login?message=password_updated";
    } catch (err: any) {
      console.error("[ResetPassword] Update error:", err);
      setErrorMessage(err?.message || "Failed to update password. Please try again.");
      setIsSubmitting(false);
    }
  };

  if (sessionStatus === "checking") {
    return (
      <div style={{ padding: "24px 0", textAlign: "center", color: "var(--muted)" }}>
        <p style={{ margin: 0, fontSize: 14 }}>Verifying security credentials...</p>
      </div>
    );
  }

  if (sessionStatus === "invalid") {
    return (
      <div className="form-stack">
        <div className="error" role="alert" style={{ margin: "14px 0" }}>
          <p style={{ margin: 0, fontWeight: 500 }}>{errorMessage || "That recovery link is invalid or has expired."}</p>
        </div>
        <Link
          href="/reset-password"
          className="button button-primary"
          style={{ textAlign: "center", display: "inline-block", textDecoration: "none" }}
        >
          Request a Fresh Reset Link &rarr;
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="form-stack">
      {errorMessage && (
        <div className="error" role="alert" style={{ margin: "10px 0" }}>
          <p style={{ margin: 0 }}>{errorMessage}</p>
        </div>
      )}

      {success && (
        <div className="notice" role="status" style={{ margin: "10px 0" }}>
          <p style={{ margin: 0 }}>Password updated! Redirecting to sign in...</p>
        </div>
      )}

      <label>
        New password
        <PasswordInput
          name="password"
          minLength={8}
          maxLength={128}
          required
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      <label>
        Confirm new password
        <PasswordInput
          name="confirmPassword"
          minLength={8}
          maxLength={128}
          required
          autoComplete="new-password"
          placeholder="Re-enter your new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </label>

      <button
        className="button button-primary"
        type="submit"
        disabled={isSubmitting || success}
        style={{ marginTop: 8 }}
      >
        {isSubmitting ? "Updating Password..." : "Update Password & Sign In"}
      </button>
    </form>
  );
}
