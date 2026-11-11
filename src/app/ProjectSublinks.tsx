"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock3, FileText, BarChart3, Paperclip } from "lucide-react";

export default function ProjectSublinks({ projectId }: { projectId: string }) {
  const pathname = usePathname();

  const isDocs = pathname.includes(`/projects/${projectId}/documents`);
  const isTimesheets = pathname.includes(`/projects/${projectId}/timesheets`);
  const isReports = pathname.includes(`/projects/${projectId}/reports`);
  const isAttachments = pathname.includes(`/projects/${projectId}/attachments`);

  return (
    <div className="hierarchy-project-sublinks">
      <Link
        className={`hierarchy-sublink${isDocs ? " is-current" : ""}`}
        href={`/projects/${projectId}/documents`}
        prefetch={false}
      >
        <FileText size={12} />
        <span>Project documents</span>
      </Link>
      <Link
        className={`hierarchy-sublink${isTimesheets ? " is-current" : ""}`}
        href={`/projects/${projectId}/timesheets`}
        prefetch={false}
      >
        <Clock3 size={12} />
        <span>Timesheets</span>
      </Link>
      <Link
        className={`hierarchy-sublink${isReports ? " is-current" : ""}`}
        href={`/projects/${projectId}/reports`}
        prefetch={false}
      >
        <BarChart3 size={12} />
        <span>Reports</span>
      </Link>
      <Link
        className={`hierarchy-sublink${isAttachments ? " is-current" : ""}`}
        href={`/projects/${projectId}/attachments`}
        prefetch={false}
      >
        <Paperclip size={12} />
        <span>Attachments</span>
      </Link>
    </div>
  );
}
