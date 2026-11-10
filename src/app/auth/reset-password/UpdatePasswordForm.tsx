"use client";

import { useState, useEffect } from "react";
import PasswordInput from "@/app/PasswordInput";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordForm({
  serverAction,
}: {
  serverAction: (formData: FormData) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // When landing with a hash fragment (#access_token=...), ensure Supabase client parses it
    try {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data, error }) => {
        if (error) {
          console.warn("[ResetPassword] Session check warning:", error.message);
        }
      });
    } catch (err) {
      console.error("[ResetPassword] Client init error:", err);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 8) {
      setErrorMessage("Your new password must be at least 8 characters long.");
      return;
    }

    if (confirmPassword && password !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please verify and try again.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        console.warn("[ResetPassword] Client update failed, falling back to server action:", error.message);
        // Fallback to server action
        const formData = new FormData();
        formData.set("password", password);
        await serverAction(formData);
        return;
      }

      // Successfully updated password
      window.location.href = "/login?message=password_updated";
    } catch (err: any) {
      console.error("[ResetPassword] Update error:", err);
      // Fall back to server action
      try {
        const formData = new FormData();
        formData.set("password", password);
        await serverAction(formData);
      } catch (serverErr: any) {
        setErrorMessage(serverErr?.message || "Failed to update password. Your reset link may have expired.");
        setIsSubmitting(false);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form-stack">
      {errorMessage && (
        <p className="error" role="alert" style={{ margin: "10px 0" }}>
          {errorMessage}
        </p>
      )}

      <label>
        New password
        <div onChange={(e: any) => setPassword(e.target.value)}>
          <PasswordInput
            name="password"
            minLength={8}
            maxLength={128}
            required
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
        </div>
      </label>

      <label>
        Confirm new password
        <div onChange={(e: any) => setConfirmPassword(e.target.value)}>
          <PasswordInput
            name="confirmPassword"
            minLength={8}
            maxLength={128}
            required
            autoComplete="new-password"
            placeholder="Re-enter your new password"
          />
        </div>
      </label>

      <button
        className="button button-primary"
        type="submit"
        disabled={isSubmitting}
        style={{ marginTop: 8 }}
      >
        {isSubmitting ? "Updating Password..." : "Update Password & Sign In"}
      </button>
    </form>
  );
}
