"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function BackButton({
  fallbackHref,
  href,
  label = "Back",
  className = "back-link",
}: {
  fallbackHref?: string;
  href?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // Determine parent hierarchical target
  let targetHref = href || fallbackHref;
  if (!targetHref && pathname) {
    // Strip the last path segment: e.g. /projects/123/tasks/456 -> /projects/123
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length > 1) {
      segments.pop();
      targetHref = `/${segments.join("/")}`;
    } else {
      targetHref = "/dashboard";
    }
  }
  if (!targetHref) targetHref = "/dashboard";

  return (
    <Link
      href={targetHref}
      className={className}
      aria-label={label}
      title={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        background: "transparent",
        border: "0",
        padding: "0",
        cursor: "pointer",
        color: "inherit",
        font: "inherit",
        textDecoration: "none",
      }}
    >
      <ArrowLeft size={15} />
      <span>{label}</span>
    </Link>
  );
}
