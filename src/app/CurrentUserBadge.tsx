import { createClient } from "@/lib/supabase/server";
import UserProfileDropdown from "./UserProfileDropdown";

export default async function CurrentUserBadge({
  email,
  organizationId,
  workspaceId,
  projectId,
}: {
  email: string;
  organizationId?: string;
  workspaceId?: string;
  projectId?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle()
    : { data: null };
  const name = profile?.display_name?.trim() || email.split("@")[0] || email;

  return (
    <UserProfileDropdown
      email={email}
      displayName={name}
      avatarUrl={profile?.avatar_url}
      organizationId={organizationId}
      workspaceId={workspaceId}
      projectId={projectId}
    />
  );
}
