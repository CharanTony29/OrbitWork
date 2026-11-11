"use client";

import { useRef, useState, useTransition } from "react";
import {
  Camera,
  KeyRound,
  Loader2,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react";
import { changeMyPassword, deleteMyAccount, updateMyAvatar } from "@/app/actions";
import PasswordInput from "@/app/PasswordInput";

type Props = {
  initialAvatarUrl: string | null;
  displayName: string;
  email: string;
};

async function resizeImageToAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read selected image."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Unsupported or corrupt image file."));
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Image processing unavailable in browser."));
          return;
        }
        // Center-crop to square
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.84);
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function ProfileAvatarSection({
  initialAvatarUrl,
  displayName,
}: {
  initialAvatarUrl: string | null;
  displayName: string;
}) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [status, setStatus] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const initial = (displayName.trim()[0] || "U").toUpperCase();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.currentTarget.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus({ type: "err", text: "Please choose an image file (PNG, JPG, WebP, or GIF)." });
      return;
    }

    setStatus(null);
    try {
      const compressed = await resizeImageToAvatarDataUrl(file);
      const fd = new FormData();
      fd.set("avatarDataUrl", compressed);
      startTransition(async () => {
        const res = await updateMyAvatar(fd);
        if (res.ok) {
          setAvatarUrl(res.avatarUrl ?? compressed);
          setStatus({ type: "ok", text: "Profile picture updated." });
        } else {
          setStatus({ type: "err", text: res.error ?? "Failed to update picture." });
        }
      });
    } catch (err) {
      setStatus({
        type: "err",
        text: err instanceof Error ? err.message : "Could not process image.",
      });
    }
  }

  function handleRemove() {
    setStatus(null);
    const fd = new FormData();
    fd.set("avatarDataUrl", "");
    startTransition(async () => {
      const res = await updateMyAvatar(fd);
      if (res.ok) {
        setAvatarUrl(null);
        setStatus({ type: "ok", text: "Profile picture removed." });
      } else {
        setStatus({ type: "err", text: res.error ?? "Could not remove picture." });
      }
    });
  }

  return (
    <section className="profile-form profile-avatar-card">
      <div className="profile-section-heading">
        <h2>Profile picture</h2>
        <p>Upload a personal avatar. Images are cropped square and stored minimal-size for fast loading.</p>
      </div>

      <div className="profile-avatar-row">
        <div className={`profile-avatar-preview${avatarUrl ? " has-avatar" : ""}`}>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={displayName} />
          ) : (
            <span>{initial}</span>
          )}
          <button
            type="button"
            className="profile-avatar-cam-badge"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
            title="Upload profile picture"
          >
            <Camera size={13} />
          </button>
        </div>

        <div className="profile-avatar-controls">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="button button-secondary"
              disabled={pending}
              onClick={() => fileRef.current?.click()}
            >
              {pending ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
              <span>{pending ? "Saving…" : avatarUrl ? "Change picture" : "Upload picture"}</span>
            </button>
            {avatarUrl && (
              <button
                type="button"
                className="button profile-danger-outline-btn"
                disabled={pending}
                onClick={handleRemove}
              >
                <Trash2 size={14} />
                <span>Remove</span>
              </button>
            )}
          </div>
          <small>Supports PNG, JPG, GIF, or WebP. Automatically resized to 256×256px.</small>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
        </div>
      </div>

      {status && (
        <p className={status.type === "ok" ? "notice" : "error"} role="status" style={{ margin: 0 }}>
          {status.text}
        </p>
      )}
    </section>
  );
}

export function ChangePasswordSection({ hasPasswordProvider }: { hasPasswordProvider: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (newPassword.length < 8) {
      setStatus({ type: "err", text: "Password must be at least 8 characters long." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus({ type: "err", text: "New password and confirmation do not match." });
      return;
    }

    const fd = new FormData();
    fd.set("currentPassword", currentPassword);
    fd.set("newPassword", newPassword);
    fd.set("confirmPassword", confirmPassword);

    startTransition(async () => {
      const res = await changeMyPassword(fd);
      if (res.ok) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setStatus({ type: "ok", text: "Your password has been updated successfully." });
      } else {
        setStatus({ type: "err", text: res.error ?? "Could not change password." });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="profile-form">
      <div className="profile-section-heading">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <KeyRound size={16} style={{ color: "var(--green)" }} />
          <h2 style={{ margin: 0 }}>Password &amp; security</h2>
        </div>
        <p style={{ marginTop: 6 }}>
          {hasPasswordProvider
            ? "Update your sign-in password anytime."
            : "Set a password if you want to sign in with email and password in addition to social / password-less login."}
        </p>
      </div>

      {status && (
        <p className={status.type === "ok" ? "notice" : "error"} role="status" style={{ margin: 0 }}>
          {status.text}
        </p>
      )}

      {hasPasswordProvider && (
        <label>
          Current password (leave blank if you only used Google / Microsoft / Password-less link)
          <PasswordInput
            name="currentPassword"
            autoComplete="current-password"
            required={false}
            minLength={0}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
          />
        </label>
      )}

      <div className="profile-form-columns">
        <label>
          New password
          <PasswordInput
            name="newPassword"
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimum 8 characters"
          />
        </label>
        <label>
          Confirm new password
          <PasswordInput
            name="confirmPassword"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
          />
        </label>
      </div>

      <footer>
        <span>Choose a strong password of at least 8 characters.</span>
        <button className="button button-primary" type="submit" disabled={pending}>
          {pending ? "Updating…" : "Update password"}
        </button>
      </footer>
    </form>
  );
}

export function DeleteAccountSection({ email }: Props) {
  const [confirmText, setConfirmText] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (confirmText.trim() !== "DELETE" || !acknowledged) {
      setError('Please check the confirmation box and type "DELETE" exactly.');
      return;
    }

    try {
      localStorage.removeItem("orbitwork_personal_notepad");
      localStorage.removeItem("orbitwork_user_status");
    } catch {}

    const fd = new FormData();
    fd.set("confirmText", "DELETE");

    startTransition(async () => {
      const res = await deleteMyAccount(fd);
      if (res && !res.ok) {
        setError(res.error ?? "Failed to erase account.");
      }
    });
  }

  return (
    <form onSubmit={handleDelete} className="profile-form profile-danger-card">
      <div className="profile-section-heading">
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#dc2626" }}>
          <ShieldAlert size={17} />
          <h2 style={{ margin: 0, color: "#dc2626" }}>Delete account &amp; erase personal data</h2>
        </div>
        <p style={{ marginTop: 6 }}>
          In compliance with India&apos;s strict Digital Personal Data Protection (DPDP) regulations, deleting your account permanently and irreversibly erases your profile ({email}), avatar, login credentials, personal messages, notifications, timesheets, leave requests, comments, and all personally identifiable information from Orbitwork. Organizations where you are the only member are also permanently deleted.
        </p>
      </div>

      {error && (
        <p className="error" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      )}

      <label className="profile-danger-checkbox">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
        />
        <span>
          I understand this permanently erases all my account information and cannot be undone.
        </span>
      </label>

      <label>
        Type <strong>DELETE</strong> to confirm permanent account erasure
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="Type DELETE"
          autoComplete="off"
        />
      </label>

      <footer>
        <span>No personal backup copies or unnecessary data will be retained.</span>
        <button
          className="button profile-danger-submit-btn"
          type="submit"
          disabled={pending || confirmText.trim() !== "DELETE" || !acknowledged}
        >
          {pending ? (
            <>
              <Loader2 size={14} className="spin" />
              <span>Erasing account…</span>
            </>
          ) : (
            <>
              <Trash2 size={14} />
              <span>Permanently delete account</span>
            </>
          )}
        </button>
      </footer>
    </form>
  );
}
