import type { Metadata } from "next";

export const CANONICAL_ORIGIN = "https://www.orbitwork.org";
export const CANONICAL_HOME_URL = "https://www.orbitwork.org/";
export const SITE_NAME = "Orbitwork";

/**
 * Normalizes any configured app origin so orbitwork.org variants
 * (http, https, apex or www) always resolve to https://www.orbitwork.org.
 */
export function normalizeAppOrigin(rawUrl?: string | null): string {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return "http://localhost:3000";

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (host === "orbitwork.org" || host === "www.orbitwork.org") {
      return CANONICAL_ORIGIN;
    }
    return parsed.origin;
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

export function getCanonicalAppOrigin(): string {
  return normalizeAppOrigin(process.env.NEXT_PUBLIC_APP_URL ?? CANONICAL_ORIGIN);
}

export function buildCanonicalUrl(pathname: string): string {
  const cleaned = pathname.trim();
  if (!cleaned || cleaned === "/") {
    return CANONICAL_HOME_URL;
  }
  const withLeadingSlash = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, "");
  return `${CANONICAL_ORIGIN}${withoutTrailingSlash}`;
}

export type PublicMetadataOptions = {
  title: string;
  absoluteTitle?: boolean;
  description: string;
  path: string;
  keywords?: string[];
  noIndex?: boolean;
};

export function buildPublicMetadata({
  title,
  absoluteTitle = false,
  description,
  path,
  keywords,
  noIndex = false,
}: PublicMetadataOptions): Metadata {
  const canonicalUrl = buildCanonicalUrl(path);
  const fullTitle =
    absoluteTitle || title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    keywords,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: fullTitle,
      description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      type: "website",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
    },
    ...(noIndex
      ? {
          robots: {
            index: false,
            follow: false,
          },
        }
      : {
          robots: {
            index: true,
            follow: true,
          },
        }),
  };
}
