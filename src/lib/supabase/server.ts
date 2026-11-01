import { createServerClient } from "@supabase/ssr";
import type { SetAllCookies } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    const missing = [
      !url ? "NEXT_PUBLIC_SUPABASE_URL" : null,
      !key ? "NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)" : null,
    ]
      .filter(Boolean)
      .join(", ");
    console.error(
      `[Supabase Client Error] Missing environment variable(s): ${missing}. Please set these in your Vercel Project Settings > Environment Variables, then Redeploy.`
    );
    throw new Error(
      `Supabase configuration error: Missing environment variable(s): ${missing}. Check Vercel Project Settings > Environment Variables.`
    );
  }

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll: ((cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server components cannot write cookies; middleware refreshes the session.
          }
        }) satisfies SetAllCookies,
      },
    },
  );
}
