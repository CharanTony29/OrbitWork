import { createBrowserClient } from "@supabase/ssr";
import { getAuthCookieDomain } from "@/lib/subdomain";

export function createClient() {
  const hostname = typeof window !== "undefined" ? window.location.hostname : undefined;
  const domain = getAuthCookieDomain(hostname);

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: domain
        ? {
            domain,
            path: "/",
            sameSite: "lax",
            secure: typeof window !== "undefined" ? window.location.protocol === "https:" : true,
          }
        : {
            path: "/",
            sameSite: "lax",
          },
    }
  );
}
