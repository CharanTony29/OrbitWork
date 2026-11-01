import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function CurrentUserBadge({ email }: { email: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
    : { data: null };
  const name = profile?.display_name?.trim() || email;
  return <Link className="user-chip" href="/profile" title={`${email} · Edit profile`} aria-label={`${name}. Open personal details`}>{name}</Link>;
}
