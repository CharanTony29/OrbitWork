import { redirect } from "next/navigation";
import AppTopBar from "@/app/AppTopBar";
import PrimarySpaceLeftSlot from "@/app/PrimarySpaceLeftSlot";
import type { ChatConversationType } from "@/lib/chat";
import { fetchProfilesMap } from "@/lib/chat-server";
import { createClient } from "@/lib/supabase/server";
import { getUserSpaceData } from "@/lib/workspace-space";
import ChatWorkspace, {
  type ChatWorkspaceProjectOption,
  type ChatWorkspaceWorkItemOption,
} from "./ChatWorkspace";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    type?: string;
    target?: string;
    channel?: string;
    recipientId?: string;
    threadId?: string;
  }>;
};

function resolveInitialSelection(sp: {
  type?: string;
  target?: string;
  channel?: string;
  recipientId?: string;
  threadId?: string;
}): { type: ChatConversationType; target: string } {
  const rawType = sp.type?.trim();
  const rawTarget = sp.target?.trim();
  if (
    (rawType === "channel" || rawType === "direct" || rawType === "group") &&
    rawTarget
  ) {
    return { type: rawType, target: rawTarget };
  }
  if (sp.threadId?.trim()) {
    return { type: "group", target: sp.threadId.trim() };
  }
  if (sp.recipientId?.trim()) {
    return { type: "direct", target: sp.recipientId.trim() };
  }
  if (sp.channel?.trim()) {
    return { type: "channel", target: sp.channel.trim() };
  }
  return { type: "channel", target: "general" };
}

export default async function ChatPage({ searchParams }: PageProps) {
  const [space, resolvedParams] = await Promise.all([
    getUserSpaceData(),
    searchParams,
  ]);
  if (!space) redirect("/login");

  const supabase = await createClient();
  const orgIds = space.organizations.map((o) => o.id);
  const primaryOrgId = orgIds[0] ?? null;
  const projectIds = space.projects.map((p) => p.id);

  // Collect unique colleague IDs across organizations
  const colleagueIdSet = new Set<string>([space.user.id]);
  for (const m of space.organizationMembers) {
    colleagueIdSet.add(m.user_id);
  }

  const [profilesMap, tasksRes, docsRes] = await Promise.all([
    fetchProfilesMap(supabase, [...colleagueIdSet]),
    projectIds.length > 0
      ? supabase
          .from("tasks")
          .select("id, project_id, title, generated_key")
          .in("project_id", projectIds.slice(0, 40))
          .order("updated_at", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] as Array<{ id: string; project_id: string; title: string; generated_key?: string | null }> }),
    projectIds.length > 0
      ? supabase
          .from("project_documents")
          .select("id, project_id, title")
          .in("project_id", projectIds.slice(0, 40))
          .order("updated_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as Array<{ id: string; project_id: string; title: string }> }),
  ]);

  const ownProfile = profilesMap.get(space.user.id);
  const workspaceNameById = new Map(space.workspaces.map((w) => [w.id, w.name]));
  const projectNameById = new Map(space.projects.map((p) => [p.id, p.name]));

  const initialMembers = [...colleagueIdSet]
    .filter((id) => id !== space.user.id)
    .map((id) => {
      const p = profilesMap.get(id);
      return {
        id,
        name: p?.name ?? "Teammate",
        email: p?.email ?? "",
        avatarUrl: p?.avatarUrl ?? null,
        presence: p?.presence ?? ("offline" as const),
        lastSeenAt: p?.lastSeenAt ?? null,
      };
    });

  const accessibleProjects: ChatWorkspaceProjectOption[] = space.projects.map(
    (p) => ({
      id: p.id,
      name: p.name,
      workspaceName: workspaceNameById.get(p.workspace_id) ?? "Workspace",
    })
  );

  const linkableItems: ChatWorkspaceWorkItemOption[] = [
    ...(tasksRes.data ?? []).map((t) => ({
      kind: "task" as const,
      id: t.id,
      title: t.title,
      href: `/projects/${t.project_id}/tasks/${t.id}`,
      subtitle: projectNameById.get(t.project_id) ?? "Task",
    })),
    ...(docsRes.data ?? []).map((d) => ({
      kind: "document" as const,
      id: d.id,
      title: d.title,
      href: `/projects/${d.project_id}/documents/${d.id}`,
      subtitle: projectNameById.get(d.project_id) ?? "Document",
    })),
    ...accessibleProjects.map((p) => ({
      kind: "project" as const,
      id: p.id,
      title: p.name,
      href: `/projects/${p.id}`,
      subtitle: p.workspaceName,
    })),
  ];

  const initialSelection = resolveInitialSelection(resolvedParams);

  return (
    <div className="ov-shell chat-page-shell">
      <AppTopBar
        email={space.user.email ?? ""}
        organizationId={primaryOrgId ?? undefined}
        leftSlot={
          <PrimarySpaceLeftSlot
            activeNav="chat"
            assignedTaskCount={space.assignedTaskCount}
          />
        }
      />

      <ChatWorkspace
        currentUserId={space.user.id}
        currentUserName={ownProfile?.name ?? space.displayName}
        currentUserEmail={space.user.email ?? ""}
        currentUserAvatarUrl={ownProfile?.avatarUrl ?? null}
        primaryOrgId={primaryOrgId}
        initialMembers={initialMembers}
        accessibleProjects={accessibleProjects}
        linkableItems={linkableItems}
        initialSelection={initialSelection}
      />
    </div>
  );
}
