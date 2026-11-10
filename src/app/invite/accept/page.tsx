import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AcceptInvitation({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token || token.length > 100) redirect("/login?error=invalid_invitation");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?returnUrl=${encodeURIComponent(`/invite/accept?token=${token}`)}&message=sign_in_to_accept`);
  }

  // 1. Accept specific invitation with token
  const { data: organizationId, error } = await supabase.rpc("accept_organization_invitation", { invite_token: token });

  // 2. Also run auto-acceptance for any pending invitations matching user's email
  await supabase.rpc("accept_user_pending_invitations");

  if (error && !organizationId) {
    // If token was already accepted or user is already an active member, gracefully proceed to dashboard
    const { data: member } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).maybeSingle();
    if (member) {
      redirect("/dashboard?invitation_accepted=1");
    }
    redirect("/dashboard?error=invitation_accept_failed");
  }

  redirect("/dashboard?invitation_accepted=1");
}
