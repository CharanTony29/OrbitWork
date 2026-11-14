import type { NextRequest } from "next/server";

export type SubdomainKind =
  | "apex"
  | "www"
  | "app"
  | "api"
  | "docs"
  | "support"
  | "status"
  | "blog"
  | "unknown";

export interface HostInfo {
  rawHost: string;
  hostname: string;
  port: string | null;
  protocol: string;
  subdomain: string | null;
  kind: SubdomainKind;
  isLocal: boolean;
  isPreview: boolean;
  isProduction: boolean;
}

const KNOWN_SUBDOMAINS = new Set([
  "www",
  "app",
  "api",
  "docs",
  "support",
  "status",
  "blog",
]);

export const APP_ROUTE_PREFIXES = [
  "/dashboard",
  "/my-dashboard",
  "/login",
  "/signup",
  "/workspaces",
  "/projects",
  "/canvas",
  "/chat",
  "/planner",
  "/profile",
  "/inbox",
  "/invite",
  "/reset-password",
  "/organizations",
] as const;

export function isAppRoute(pathname: string): boolean {
  return APP_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Returns the cookie domain (e.g. '.orbitwork.org') for multi-subdomain session sharing.
 * Returns undefined for localhost or preview environments so host-only cookies are used.
 */
export function getAuthCookieDomain(hostname?: string | null): string | undefined {
  if (!hostname) return undefined;
  const clean = hostname.split(",")[0].trim().split(":")[0].toLowerCase();
  if (clean === "orbitwork.org" || clean.endsWith(".orbitwork.org")) {
    return ".orbitwork.org";
  }
  return undefined;
}

/**
 * Extracts and classifies the requested hostname, environment, and subdomain target.
 */
export function getHostInfo(request: NextRequest): HostInfo {
  const rawHost =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    request.nextUrl.hostname ||
    "localhost";

  const hostPart = rawHost.split(",")[0].trim();
  const [hostnameRaw, portRaw] = hostPart.split(":");
  const hostname = (hostnameRaw || "localhost").toLowerCase();
  const port = portRaw || null;

  const protocol = (
    request.headers.get("x-forwarded-proto") ||
    request.nextUrl.protocol.replace(":", "")
  )
    .split(",")[0]
    .trim()
    .toLowerCase();

  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".localhost") ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    hostname === "0.0.0.0";

  const isPreview =
    hostname.endsWith(".vercel.app") ||
    hostname.includes("preview") ||
    hostname.startsWith("staging-") ||
    hostname.startsWith("staging.");

  const isProduction =
    !isLocal && !isPreview && (hostname === "orbitwork.org" || hostname.endsWith(".orbitwork.org"));

  let subdomain: string | null = null;
  let kind: SubdomainKind = "www";

  if (isLocal) {
    if (hostname.endsWith(".localhost")) {
      const prefix = hostname.replace(/\.localhost$/, "");
      subdomain = prefix.split(".")[0];
    }
  } else if (isProduction || hostname.endsWith("orbitwork.org")) {
    if (hostname === "orbitwork.org") {
      return {
        rawHost,
        hostname,
        port,
        protocol,
        subdomain: null,
        kind: "apex",
        isLocal,
        isPreview,
        isProduction,
      };
    }
    const prefix = hostname.replace(/\.orbitwork\.org$/, "");
    subdomain = prefix.split(".")[0];
  } else if (isPreview) {
    for (const sub of KNOWN_SUBDOMAINS) {
      if (hostname.startsWith(`staging-${sub}`) || hostname.startsWith(`${sub}-`)) {
        subdomain = sub;
        break;
      }
    }
  }

  // Classify based on subdomain
  if (!subdomain || subdomain === "www") {
    kind = "www";
  } else if (subdomain === "app") {
    kind = "app";
  } else if (subdomain === "api") {
    kind = "api";
  } else if (subdomain === "docs") {
    kind = "docs";
  } else if (subdomain === "support") {
    kind = "support";
  } else if (subdomain === "status") {
    kind = "status";
  } else if (subdomain === "blog") {
    kind = "blog";
  } else {
    // Unknown subdomain on orbitwork.org (e.g. random.orbitwork.org)
    kind = "unknown";
  }

  return {
    rawHost,
    hostname,
    port,
    protocol,
    subdomain,
    kind,
    isLocal,
    isPreview,
    isProduction,
  };
}

/**
 * Returns the canonical base URL for a given subdomain kind.
 */
export function getSubdomainOrigin(kind: SubdomainKind, currentHostInfo?: HostInfo): string {
  const portSuffix = currentHostInfo?.port ? `:${currentHostInfo.port}` : "";

  if (currentHostInfo?.isLocal) {
    if (kind === "www" || kind === "apex") return `http://localhost${portSuffix}`;
    return `http://${kind}.localhost${portSuffix}`;
  }

  switch (kind) {
    case "app":
      return "https://app.orbitwork.org";
    case "api":
      return "https://api.orbitwork.org";
    case "docs":
      return "https://docs.orbitwork.org";
    case "support":
      return "https://support.orbitwork.org";
    case "status":
      return "https://status.orbitwork.org";
    case "blog":
      return "https://blog.orbitwork.org";
    case "apex":
    case "www":
    default:
      return "https://www.orbitwork.org";
  }
}
