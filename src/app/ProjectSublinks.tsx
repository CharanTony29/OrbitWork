"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Clock3, FileText, BarChart3, Paperclip, Brain } from "lucide-react";

export default function ProjectSublinks({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isBrain = pathname === `/projects/${projectId}` && searchParams.get("view") === "brain";
  const isDocs = pathname.includes(`/projects/${projectId}/documents`);
  const isTimesheets = pathname.includes(`/projects/${projectId}/timesheets`);
  const isReports = pathname.includes(`/projects/${projectId}/reports`);
  const isAttachments = pathname.includes(`/projects/${projectId}/attachments`);

  const handleBrainClick = (e: React.MouseEvent) => {
    if (pathname === `/projects/${projectId}`) {
      e.preventDefault();
      window.dispatchEvent(
        new CustomEvent("orbitwork:switch-project-tab", { detail: { view: "brain" } })
      );
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("view", "brain");
        window.history.replaceState(null, "", url.toString());
      }
    }
  };

  return (
    <div className="hierarchy-project-sublinks">
      <Link
        className={`hierarchy-sublink${isBrain ? " is-current" : ""}`}
        href={`/projects/${projectId}?view=brain`}
        prefetch={true}
        data-no-progress="true"
        onClick={handleBrainClick}
      >
        <Brain size={12} style={{ color: "var(--green)" }} />
        <span>Project Brain</span>
      </Link>
      <Link
        className={`hierarchy-sublink${isDocs ? " is-current" : ""}`}
        href={`/projects/${projectId}/documents`}
        prefetch={true}
      >
        <FileText size={12} />
        <span>Project documents</span>
      </Link>
      <Link
        className={`hierarchy-sublink${isTimesheets ? " is-current" : ""}`}
        href={`/projects/${projectId}/timesheets`}
        prefetch={true}
      >
        <Clock3 size={12} />
        <span>Timesheets</span>
      </Link>
      <Link
        className={`hierarchy-sublink${isReports ? " is-current" : ""}`}
        href={`/projects/${projectId}/reports`}
        prefetch={true}
      >
        <BarChart3 size={12} />
        <span>Reports</span>
      </Link>
      <Link
        className={`hierarchy-sublink${isAttachments ? " is-current" : ""}`}
        href={`/projects/${projectId}/attachments`}
        prefetch={true}
      >
        <Paperclip size={12} />
        <span>Attachments</span>
      </Link>
    </div>
  );
}
