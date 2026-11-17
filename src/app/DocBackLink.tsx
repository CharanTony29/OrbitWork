"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function DocBackLink({
  href,
  label = "Back to Documents",
}: {
  href: string;
  label?: string;
}) {
  const router = useRouter();

  const handleNavigate = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push(href);
  };

  return (
    <button
      type="button"
      onClick={handleNavigate}
      className="back-link"
      style={{
        background: "transparent",
        border: "none",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        font: "inherit",
        color: "inherit",
        padding: 0,
      }}
      aria-label={label}
    >
      <ArrowLeft size={15} />
      <span>{label}</span>
    </button>
  );
}
