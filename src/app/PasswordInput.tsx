"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function PasswordInput({
  name = "password",
  autoComplete = "current-password",
  required = true,
  minLength = 8,
  maxLength = 128,
  placeholder,
  id,
  defaultValue,
}: {
  name?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  id?: string;
  defaultValue?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", width: "100%" }}>
      <input
        id={id}
        name={name}
        type={showPassword ? "text" : "password"}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        placeholder={placeholder}
        defaultValue={defaultValue}
        style={{ width: "100%", paddingRight: "42px" }}
      />
      <button
        type="button"
        onClick={() => setShowPassword((prev) => !prev)}
        aria-label={showPassword ? "Hide password" : "Show password"}
        title={showPassword ? "Hide password" : "Show password"}
        style={{
          position: "absolute",
          right: "10px",
          top: "50%",
          transform: "translateY(-50%)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "6px",
          color: "var(--muted, #64748b)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "6px",
          zIndex: 2,
        }}
      >
        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}
