import { createServerClient } from "@supabase/ssr";
import type { SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { CANONICAL_ORIGIN, normalizeAppOrigin } from "@/lib/seo";

export async function updateSession(request: NextRequest) {
  // Enforce one canonical origin (https://www.orbitwork.org) across all public routes
  if (
    (request.method === "GET" || request.method === "HEAD") &&
    !request.nextUrl.pathname.startsWith("/api/") &&
    !request.nextUrl.pathname.startsWith("/auth/callback")
  ) {
    try {
      const reqHost = (
        request.headers.get("x-forwarded-host") ||
        request.headers.get("host") ||
        request.nextUrl.hostname
      )
        .split(",")[0]
        .trim()
        .split(":")[0]
        .toLowerCase();
      const reqProto = (
        request.headers.get("x-forwarded-proto") ||
        request.nextUrl.protocol.replace(":", "")
      )
        .split(",")[0]
        .trim()
        .toLowerCase();

      if (reqHost === "orbitwork.org" || (reqHost === "www.orbitwork.org" && reqProto === "http")) {
        const target = new URL(
          `${request.nextUrl.pathname}${request.nextUrl.search}`,
          CANONICAL_ORIGIN
        );
        return NextResponse.redirect(target, 308);
      }

      const envAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
      if (envAppUrl) {
        const canonical = new URL(normalizeAppOrigin(envAppUrl));
        const canonicalHost = canonical.hostname.toLowerCase();
        if (
          reqHost &&
          reqHost !== canonicalHost &&
          reqHost.replace(/^www\./, "") === canonicalHost.replace(/^www\./, "")
        ) {
          const target = new URL(
            `${request.nextUrl.pathname}${request.nextUrl.search}`,
            canonical.origin
          );
          return NextResponse.redirect(target, 308);
        }
      }
    } catch {}
  }

  let response = NextResponse.next({ request });

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
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: ((cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }) satisfies SetAllCookies,
    },
  });

  await supabase.auth.getUser();
  return response;
}
