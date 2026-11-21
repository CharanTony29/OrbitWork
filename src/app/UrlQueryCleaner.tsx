"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function UrlQueryCleaner({
  paramsToClean = [
    "error",
    "member_added",
    "member_removed",
    "member_updated",
    "hierarchy_updated",
    "invited",
    "designation_created",
    "designation_deleted",
    "invitation_accepted",
    "status_updated",
    "project_deleted",
    "drive",
    "storage",
  ],
}: {
  paramsToClean?: string[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;

    let hasChange = false;
    const currentParams = new URLSearchParams(window.location.search);

    for (const key of paramsToClean) {
      if (currentParams.has(key)) {
        hasChange = true;
        currentParams.delete(key);
      }
    }

    if (hasChange) {
      const remaining = currentParams.toString();
      const cleanUrl = remaining ? `${pathname}?${remaining}` : pathname;
      // Replace browser history entry so page refreshes won't repeat transient params
      window.history.replaceState(null, "", cleanUrl);
    }
  }, [pathname, searchParams, paramsToClean]);

  return null;
}
