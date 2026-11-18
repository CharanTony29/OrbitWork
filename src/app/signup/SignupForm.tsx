"use client";

import { useState } from "react";
import PasswordInput from "@/app/PasswordInput";
import SocialAuthButtons from "@/app/auth/SocialAuthButtons";
import { UserPlus, Sparkles } from "lucide-react";

export default function SignupForm({
  returnUrl,
  emailDefault,
  signUpAction,
  magicLinkAction,
}: {
  returnUrl: string;
  emailDefault: string;
  signUpAction: (formData: FormData) => void;
  magicLinkAction: (formData: FormData) => void;
}) {
  const [tab, setTab] = useState<"standard" | "magic">("standard");

  return (
    <div className="auth-form-wrapper">
      <SocialAuthButtons returnUrl={returnUrl} mode="signup" />

      <div className="auth-tab-group" role="tablist" aria-label="Sign up method">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "standard"}
          className={`auth-tab-btn ${tab === "standard" ? "is-active" : ""}`}
          onClick={() => setTab("standard")}
        >
          <UserPlus size={13} />
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
          <span>Password-less</span>
        </button>
      </div>

      {tab === "standard" ? (
        <form action={signUpAction} className="form-stack auth-compact-stack">
          {returnUrl && <input type="hidden" name="returnUrl" value={returnUrl} />}
          <label>
            Work email
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
            Create password (min. 8 characters)
            <PasswordInput name="password" autoComplete="new-password" required minLength={8} maxLength={128} />
          </label>
          <div className="auth-consent-row">
            <input
              type="checkbox"
              id="signup-consent"
              name="termsConsent"
              required
              defaultChecked
              className="auth-consent-checkbox"
            />
            <label htmlFor="signup-consent" className="auth-consent-label">
              I agree to the{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer">
                Terms of Service
              </a>{" "}
              &amp;{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
              , and consent to receive essential service and task notification emails.
            </label>
          </div>
          <button className="button button-primary" type="submit" style={{ marginTop: 4 }}>
            Create Account
          </button>
        </form>
      ) : (
        <form action={magicLinkAction} className="form-stack auth-compact-stack">
          <input type="hidden" name="from" value="signup" />
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
            No password required. We’ll email you a secure direct-access link to instantly start.
          </p>
          <div className="auth-consent-row">
            <input
              type="checkbox"
              id="magic-consent"
              name="termsConsent"
              required
              defaultChecked
              className="auth-consent-checkbox"
            />
            <label htmlFor="magic-consent" className="auth-consent-label">
              I agree to the{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer">
                Terms of Service
              </a>{" "}
              &amp;{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
              , and consent to receive essential service and task notification emails.
            </label>
          </div>
          <button className="button button-secondary" type="submit" style={{ marginTop: 4 }}>
            Password-less sign up
          </button>
        </form>
      )}
    </div>
  );
}
