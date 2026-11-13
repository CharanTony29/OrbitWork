import type { CSSProperties } from "react";

/**
 * Renders the Orbitwork brand logo mark with aria-hidden so crawlers and
 * screen readers read the adjacent "Orbitwork" wordmark cleanly.
 */
export function BrandMark({
  className = "brand-mark",
  size = 28,
  style,
  priority = false,
}: {
  className?: string;
  size?: number;
  style?: CSSProperties;
  priority?: boolean;
}) {
  // Serve crisp, responsive 32w/64w assets for small UI marks (saving ~67 KiB over 512px master)
  const src = size <= 48 ? "/logo-64.png?v=3" : "/logo.png?v=3";
  const srcSet = size <= 48 ? "/logo-32.png?v=3 32w, /logo-64.png?v=3 64w" : undefined;

  return (
    <span className={className} aria-hidden="true" style={style}>
      <img
        src={src}
        srcSet={srcSet}
        sizes={`${size}px`}
        alt=""
        width={size}
        height={size}
        className="brand-mark-img"
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
      />
    </span>
  );
}
