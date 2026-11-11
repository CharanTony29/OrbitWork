import { createServerClient } from "@supabase/ssr";
import type { SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // Normalize www. vs non-www. to match NEXT_PUBLIC_APP_URL so auth/PKCE cookies share a single origin
  const envAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (
    envAppUrl &&
    request.method === "GET" &&
    !request.nextUrl.pathname.startsWith("/api/") &&
    !request.nextUrl.pathname.startsWith("/auth/callback")
  ) {
    try {
      const canonical = new URL(envAppUrl);
      const reqHost = (request.headers.get("x-forwarded-host") || request.nextUrl.hostname)
        .split(",")[0]
        .trim()
        .split(":")[0]
        .toLowerCase();
      const canonicalHost = canonical.hostname.toLowerCase();
      if (
        reqHost &&
        reqHost !== canonicalHost &&
        reqHost.replace(/^www\./, "") === canonicalHost.replace(/^www\./, "")
      ) {
        const target = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, canonical.origin);
        return NextResponse.redirect(target, 308);
      }
    } catch {}
  }

  let response = NextResponse.next({ request });
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
