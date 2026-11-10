"use client";

import { useState } from "react";
import Link from "next/link";
import PasswordInput from "@/app/PasswordInput";
import SocialAuthButtons from "@/app/auth/SocialAuthButtons";
import { KeyRound, Sparkles } from "lucide-react";

export default function LoginForm({
  returnUrl,
  emailDefault,
  signInAction,
  magicLinkAction,
  resetLink,
}: {
  returnUrl: string;
  emailDefault: string;
  signInAction: (formData: FormData) => void;
  magicLinkAction: (formData: FormData) => void;
  resetLink: string;
}) {
  const [tab, setTab] = useState<"password" | "magic">("password");

  return (
    <div className="auth-form-wrapper">
      <SocialAuthButtons returnUrl={returnUrl} mode="signin" />

      {/* Segmented Auth Mode Switcher */}
      <div className="auth-tab-group" role="tablist" aria-label="Sign in method">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "password"}
          className={`auth-tab-btn ${tab === "password" ? "is-active" : ""}`}
          onClick={() => setTab("password")}
        >
          <KeyRound size={13} />
          <span>Password</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "magic"}
          className={`auth-tab-btn ${tab === "magic" ? "is-active" : ""}`}
          onClick={() => setTab("magic")}
        >
          <Sparkles size={13} />
          <span>Magic Link</span>
        </button>
      </div>

      {tab === "password" ? (
        <form action={signInAction} className="form-stack auth-compact-stack">
          {returnUrl && <input type="hidden" name="returnUrl" value={returnUrl} />}
          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              defaultValue={emailDefault}
              placeholder="you@company.com"
            />
          </label>
          <label>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Password</span>
              <Link href={resetLink} style={{ color: "var(--green)", fontSize: "11px", fontWeight: 600 }}>
                Forgot?
              </Link>
            </div>
            <PasswordInput name="password" autoComplete="current-password" required minLength={8} maxLength={128} />
          </label>
          <button className="button button-primary" type="submit" style={{ marginTop: 4 }}>
            Sign in
          </button>
        </form>
      ) : (
        <form action={magicLinkAction} className="form-stack auth-compact-stack">
          <input type="hidden" name="from" value="login" />
          {returnUrl && <input type="hidden" name="returnUrl" value={returnUrl} />}
          <label>
            Work email
            <input
              name="email"
              type="email"
              placeholder="you@company.com"
              required
              maxLength={254}
              defaultValue={emailDefault}
            />
          </label>
          <p style={{ fontSize: 11, color: "var(--muted)", margin: "0", lineHeight: 1.4 }}>
            We’ll send a secure one-click sign-in link to your inbox. No password needed.
          </p>
          <button className="button button-secondary" type="submit" style={{ marginTop: 4 }}>
            Send Magic Link
          </button>
        </form>
      )}
    </div>
  );
}
