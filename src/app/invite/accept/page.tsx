import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AcceptInvitation({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token || token.length > 100) redirect("/?error=invalid_invitation");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?message=sign_in_to_accept");
  const { data: organizationId, error } = await supabase.rpc("accept_organization_invitation", { invite_token: token });
  if (error || !organizationId) redirect("/dashboard?error=invitation_accept_failed");
  redirect("/dashboard?invitation_accepted=1");
}
