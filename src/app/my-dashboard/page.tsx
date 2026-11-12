import { redirect } from "next/navigation";
import AppTopBar from "@/app/AppTopBar";
import PrimarySpaceLeftSlot from "@/app/PrimarySpaceLeftSlot";
import UserDashboardSection from "@/app/dashboard/UserDashboardSection";
import { getUserSpaceData } from "@/lib/workspace-space";

export default async function MyDashboardPage() {
  const space = await getUserSpaceData();
  if (!space) redirect("/login");

  return (
    <main className="app-shell ov-shell ov-fullpage-shell">
      <AppTopBar
        email={space.user.email ?? ""}
        leftSlot={
          <PrimarySpaceLeftSlot
            activeNav="dashboard"
            assignedTaskCount={space.assignedTaskCount}
          />
        }
      />
      <section className="ov-fullpage-content">
        <div className="ov-command-wrap ov-full-wrap">
          <header className="ov-page-header">
            <div className="ov-page-header-copy">
              <span className="ov-eyebrow">PERSONAL DASHBOARD</span>
              <h1>Welcome back, {space.displayName}.</h1>
              <p>
                Track your projects, assigned tasks, priority work, billable hours, and pinned favorites.
              </p>
            </div>
          </header>

          <UserDashboardSection
            userId={space.user.id}
            projects={space.projects}
          />
        </div>
      </section>
    </main>
  );
}
