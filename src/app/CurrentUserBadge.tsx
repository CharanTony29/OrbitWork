import { createClient, getAuthUser } from "@/lib/supabase/server";
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
  const { data: { user } } = await getAuthUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle()
    : { data: null };
  const name = profile?.display_name?.trim() || email.split("@")[0] || email;
  const rawAvatar = profile?.avatar_url?.trim();
  const safeAvatarUrl = rawAvatar?.startsWith("data:")
    ? `/api/profile/avatar?v=${encodeURIComponent(`${rawAvatar.length}-${rawAvatar.slice(-12)}`)}`
    : rawAvatar || null;

  return (
    <UserProfileDropdown
      email={email}
      displayName={name}
      avatarUrl={safeAvatarUrl}
      organizationId={organizationId}
      workspaceId={workspaceId}
      projectId={projectId}
    />
  );
}
