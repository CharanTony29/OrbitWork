"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock3, FileText, BarChart3 } from "lucide-react";

export default function ProjectSublinks({ projectId }: { projectId: string }) {
  const pathname = usePathname();

  const isDocs = pathname.includes(`/projects/${projectId}/documents`);
  const isTimesheets = pathname.includes(`/projects/${projectId}/timesheets`);
  const isReports = pathname.includes(`/projects/${projectId}/reports`);

  return (
    <div className="hierarchy-project-sublinks">
      <Link
        className={`hierarchy-sublink${isDocs ? " is-current" : ""}`}
        href={`/projects/${projectId}/documents`}
      >
        <FileText size={12} />
        <span>Project documents</span>
      </Link>
      <Link
        className={`hierarchy-sublink${isTimesheets ? " is-current" : ""}`}
        href={`/projects/${projectId}/timesheets`}
      >
        <Clock3 size={12} />
        <span>Timesheets</span>
      </Link>
      <Link
        className={`hierarchy-sublink${isReports ? " is-current" : ""}`}
        href={`/projects/${projectId}/reports`}
      >
        <BarChart3 size={12} />
        <span>Reports</span>
      </Link>
    </div>
  );
}
