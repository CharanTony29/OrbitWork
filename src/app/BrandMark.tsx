import type { CSSProperties } from "react";

/**
 * Renders the Orbitwork brand logo mark with aria-hidden so crawlers and
 * screen readers read the adjacent "Orbitwork" wordmark cleanly.
 */
export function BrandMark({
  className = "brand-mark",
  size = 28,
  style,
}: {
  className?: string;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <span className={className} aria-hidden="true" style={style}>
      <img
        src="/logo.png"
        alt=""
        width={size}
        height={size}
        className="brand-mark-img"
      />
    </span>
  );
}
