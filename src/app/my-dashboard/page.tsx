import Link from "next/link";
import { redirect } from "next/navigation";
import AppTopBar from "@/app/AppTopBar";
import SpaceSidebar from "@/app/SpaceSidebar";
import UserDashboardSection from "@/app/dashboard/UserDashboardSection";
import { getUserSpaceData } from "@/lib/workspace-space";

export default async function MyDashboardPage() {
  const space = await getUserSpaceData();
  if (!space) redirect("/login");

  return (
    <main className="app-shell ov-shell">
      <AppTopBar
        email={space.user.email ?? ""}
        leftSlot={
          <Link className="brand ov-brand" href="/dashboard">
            <span className="brand-mark">O</span>
            <span>
              Orbit<span className="ov-brand-accent">Work</span>
            </span>
          </Link>
        }
      />
      <div className="dashboard-layout ov-layout">
        <SpaceSidebar
          activeNav="dashboard"
          assignedTaskCount={space.assignedTaskCount}
          organizations={space.organizations}
          workspaces={space.workspaces}
          projects={space.projects}
        />
        <section className="dashboard-content ov-content">
          <div className="ov-command-wrap">
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
      </div>
    </main>
  );
}
