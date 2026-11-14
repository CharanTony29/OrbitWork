import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getHostInfo,
  getSubdomainOrigin,
  isAppRoute,
  getAuthCookieDomain,
  type HostInfo,
} from "@/lib/subdomain";

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const hostInfo = getHostInfo(request);
  const { pathname, search } = request.nextUrl;

  // 1. Auth callback routing: Ensure PKCE code exchange happens on app.orbitwork.org where cookies live
  if (pathname.startsWith("/auth/callback")) {
    if (hostInfo.isProduction && hostInfo.kind !== "app") {
      const targetUrl = new URL(`${pathname}${search}`, "https://app.orbitwork.org");
      return NextResponse.redirect(targetUrl, 307);
    }
  }

  // 2. Apex hostname redirect: orbitwork.org -> https://www.orbitwork.org
  if (hostInfo.kind === "apex") {
    const targetUrl = new URL(`${pathname}${search}`, "https://www.orbitwork.org");
    return NextResponse.redirect(targetUrl, 308);
  }

  // 3. HTTPS enforcement on production
  if (hostInfo.isProduction && hostInfo.protocol === "http") {
    const httpsUrl = new URL(`${pathname}${search}`, `https://${hostInfo.hostname}`);
    return NextResponse.redirect(httpsUrl, 308);
  }

  // 4. Security: Reject unrecognized subdomains on production with explicit 404
  if (hostInfo.isProduction && hostInfo.kind === "unknown") {
    return new NextResponse("404 Not Found - Subdomain not recognized", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // 5. Subdomain routing logic
  switch (hostInfo.kind) {
    case "api": {
      // API host: Must NOT render marketing or app UI.
      if (pathname === "/" || pathname === "/api") {
        const rewriteUrl = new URL(`/api${search}`, request.url);
        return NextResponse.rewrite(rewriteUrl, { request });
      }
      if (pathname === "/health") {
        const rewriteUrl = new URL(`/api/health${search}`, request.url);
        return NextResponse.rewrite(rewriteUrl, { request });
      }
      if (pathname.startsWith("/api/")) {
        return NextResponse.next({ request });
      }

      // Check if user is trying to access web/app UI routes on api.orbitwork.org
      const topSegment = pathname.split("/")[1] || "";
      const isKnownAppOrMarketingRoute =
        isAppRoute(pathname) ||
        [
          "about",
          "contact",
          "services",
          "pricing",
          "docs",
          "support",
          "status",
          "blog",
          "projects-case-studies",
          "free-project-management-software",
          "project-management-software",
          "jira-alternative",
          "free-jira-alternative",
          "asana-alternative",
          "clickup-alternative",
          "monday-alternative",
        ].includes(topSegment);

      if (isKnownAppOrMarketingRoute) {
        return NextResponse.json(
          {
            error: "Not Found",
            message: `The route '${pathname}' is not an API endpoint on api.orbitwork.org. For the web interface, please visit https://app.orbitwork.org or https://www.orbitwork.org.`,
            status: 404,
          },
          { status: 404 }
        );
      }

      // Rewrite any other path to /api/:path
      const rewriteUrl = new URL(`/api${pathname}${search}`, request.url);
      return NextResponse.rewrite(rewriteUrl, { request });
    }

    case "app": {
      // Production OrbitWork application
      // Must open actual application/dashboard/login flow; do NOT redirect to www.orbitwork.org
      if (pathname === "/") {
        const hasSession = request.cookies
          .getAll()
          .some(({ name }) => name.startsWith("sb-"));
        const targetPath = hasSession ? "/dashboard" : "/login";
        const targetOrigin = getSubdomainOrigin("app", hostInfo);
        return NextResponse.redirect(new URL(`${targetPath}${search}`, targetOrigin), 307);
      }

      // Portals on app domain: redirect to dedicated subdomains in production
      if (hostInfo.isProduction) {
        if (pathname === "/docs" || pathname.startsWith("/docs/")) {
          const docPath = pathname.replace(/^\/docs/, "") || "/";
          return NextResponse.redirect(new URL(`${docPath}${search}`, "https://docs.orbitwork.org"), 308);
        }
        if (pathname === "/support" || pathname.startsWith("/support/")) {
          const supPath = pathname.replace(/^\/support/, "") || "/";
          return NextResponse.redirect(new URL(`${supPath}${search}`, "https://support.orbitwork.org"), 308);
        }
        if (pathname === "/status" || pathname.startsWith("/status/")) {
          const stPath = pathname.replace(/^\/status/, "") || "/";
          return NextResponse.redirect(new URL(`${stPath}${search}`, "https://status.orbitwork.org"), 308);
        }
        if (pathname === "/blog" || pathname.startsWith("/blog/")) {
          const blPath = pathname.replace(/^\/blog/, "") || "/";
          return NextResponse.redirect(new URL(`${blPath}${search}`, "https://blog.orbitwork.org"), 308);
        }
      }
      break;
    }

    case "docs": {
      // Documentation subdomain
      let targetPath: string;
      if (pathname === "/" || pathname === "/docs") {
        targetPath = "/docs";
      } else if (pathname.startsWith("/docs/")) {
        targetPath = pathname;
      } else {
        targetPath = `/docs${pathname}`;
      }

      const rewriteUrl = new URL(`${targetPath}${search}`, request.url);
      return handleSessionAndResponse(request, NextResponse.rewrite(rewriteUrl, { request }));
    }

    case "support": {
      // Support subdomain
      let targetPath: string;
      if (pathname === "/" || pathname === "/support") {
        targetPath = "/support";
      } else if (pathname.startsWith("/support/")) {
        targetPath = pathname;
      } else {
        targetPath = `/support${pathname}`;
      }

      const rewriteUrl = new URL(`${targetPath}${search}`, request.url);
      return handleSessionAndResponse(request, NextResponse.rewrite(rewriteUrl, { request }));
    }

    case "status": {
      // Status subdomain
      let targetPath: string;
      if (pathname === "/" || pathname === "/status") {
        targetPath = "/status";
      } else if (pathname.startsWith("/status/")) {
        targetPath = pathname;
      } else {
        targetPath = `/status${pathname}`;
      }

      const rewriteUrl = new URL(`${targetPath}${search}`, request.url);
      return handleSessionAndResponse(request, NextResponse.rewrite(rewriteUrl, { request }));
    }

    case "blog": {
      // Blog subdomain
      let targetPath: string;
      if (pathname === "/" || pathname === "/blog") {
        targetPath = "/blog";
      } else if (pathname.startsWith("/blog/")) {
        targetPath = pathname;
      } else {
        targetPath = `/blog${pathname}`;
      }

      const rewriteUrl = new URL(`${targetPath}${search}`, request.url);
      return handleSessionAndResponse(request, NextResponse.rewrite(rewriteUrl, { request }));
    }

    case "www": {
      // Marketing website
      // In production, route application deep links to app.orbitwork.org
      if (hostInfo.isProduction) {
        if (isAppRoute(pathname)) {
          return NextResponse.redirect(
            new URL(`${pathname}${search}`, "https://app.orbitwork.org"),
            307
          );
        }
        if (pathname === "/docs" || pathname.startsWith("/docs/")) {
          const docPath = pathname.replace(/^\/docs/, "") || "/";
          return NextResponse.redirect(new URL(`${docPath}${search}`, "https://docs.orbitwork.org"), 308);
        }
        if (pathname === "/support" || pathname.startsWith("/support/")) {
          const supPath = pathname.replace(/^\/support/, "") || "/";
          return NextResponse.redirect(new URL(`${supPath}${search}`, "https://support.orbitwork.org"), 308);
        }
        if (pathname === "/status" || pathname.startsWith("/status/")) {
          const stPath = pathname.replace(/^\/status/, "") || "/";
          return NextResponse.redirect(new URL(`${stPath}${search}`, "https://status.orbitwork.org"), 308);
        }
        if (pathname === "/blog" || pathname.startsWith("/blog/")) {
          const blPath = pathname.replace(/^\/blog/, "") || "/";
          return NextResponse.redirect(new URL(`${blPath}${search}`, "https://blog.orbitwork.org"), 308);
        }
      }
      break;
    }

    default:
      break;
  }

  // Fallthrough for app routes and normal next()
  const initialResponse = NextResponse.next({ request });
  return handleSessionAndResponse(request, initialResponse);
}

/**
 * Refreshes Supabase session tokens if session cookies exist, preserving all cookies on the response
 * and scoping them to .orbitwork.org across all subdomains.
 */
async function handleSessionAndResponse(
  request: NextRequest,
  response: NextResponse
): Promise<NextResponse> {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return response;
  }

  const hasSupabaseSessionCookie = request.cookies
    .getAll()
    .some(({ name }) => name.startsWith("sb-"));

  if (!hasSupabaseSessionCookie) {
    return response;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return response;
  }

  const hostInfo = getHostInfo(request);
  const domain = getAuthCookieDomain(hostInfo.hostname);

  try {
    const supabase = createServerClient(url, key, {
      cookieOptions: domain
        ? {
            domain,
            path: "/",
            sameSite: "lax",
            secure: hostInfo.isProduction,
          }
        : {
            path: "/",
            sameSite: "lax",
          },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: ((cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              ...(domain ? { domain } : {}),
              path: options?.path ?? "/",
              sameSite: options?.sameSite ?? "lax",
              secure: hostInfo.isProduction ? true : options?.secure,
            })
          );
        }) satisfies SetAllCookies,
      },
    });

    await supabase.auth.getUser();
  } catch (err) {
    console.error("Supabase session update error in middleware:", err);
  }

  return response;
}
