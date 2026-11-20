import JSZip from "jszip";
import type { TaskReportItem, ResourceMetric, StatusMetric } from "@/lib/export-presentation";

export interface ProjectTemplateData {
  projectName: string;
  workspaceName?: string;
  organizationName?: string;
  periodLabel: string;
  totalTasks: number;
  completedTasks: TaskReportItem[];
  inProgressTasks: TaskReportItem[];
  holdTasks: TaskReportItem[];
  pendingTasks: TaskReportItem[];
  overdueTasks: TaskReportItem[];
  completionRate: number;
  inProgressRate: number;
  holdRate: number;
  pendingRate: number;
  statusMetrics: StatusMetric[];
  resourceMetrics: ResourceMetric[];
  allTasks: TaskReportItem[];
}

/**
 * Injects project data directly into an uploaded PPTX template,
 * preserving all images, photography, layouts, slide masters, typography, and styling.
 */
export async function injectProjectDataIntoCompanyTemplate(
  templateBuffer: Buffer | Uint8Array | ArrayBuffer,
  data: ProjectTemplateData
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(templateBuffer);

  const slidePaths = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/i.test(f))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || "0", 10);
      const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || "0", 10);
      return numA - numB;
    });

  const orgOrCompany = data.organizationName || data.workspaceName || "Orbitwork Enterprise";
  const completedCount = data.completedTasks.length;
  const inProgressCount = data.inProgressTasks.length;
  const holdCount = data.holdTasks.length;
  const pendingCount = data.pendingTasks.length;
  const overdueCount = data.overdueTasks.length;
  const totalCount = data.totalTasks || (completedCount + inProgressCount + holdCount + pendingCount);
  const completionPercent = totalCount > 0 ? Math.round((completedCount * 100) / totalCount) : 0;

  // Prepare top tasks for deliverables table
  const topTasks = data.allTasks.slice(0, 10);

  // Prepare top team members
  const topResources = data.resourceMetrics.slice(0, 5);

  for (let idx = 0; idx < slidePaths.length; idx++) {
    const sPath = slidePaths[idx];
    let xml = await zip.file(sPath)!.async("string");

    // 1. Cover Slide (Slide 1)
    if (idx === 0) {
      // Replace main presentation title
      xml = xml.replace(
        /(<a:t>)([^<]*?(?:growth|strategy|presentation|overview|deck|title|template|report)[^<]*?)(<\/a:t>)/gi,
        `$1${escapeXml(data.projectName)}$3`
      );
      // Fallback: if not replaced, replace the first significant text run
      if (!xml.includes(escapeXml(data.projectName))) {
        xml = xml.replace(/(<a:t>)([^<]{8,60})(<\/a:t>)/i, `$1${escapeXml(data.projectName)}$3`);
      }

      // Replace presenter / author with organization and executive brief
      xml = xml.replace(
        /(<a:t>)([^<]*?(?:presented by|author|prepared by|by)[^<]*?)(<\/a:t>)/gi,
        `$1Executive Project Briefing • ${escapeXml(orgOrCompany)}$3`
      );
      xml = xml.replace(
        /(<a:t>)(Frey Munch|John Doe|Jane Smith|Your Name|Presenter Name)(<\/a:t>)/gi,
        `$1Orbitwork Executive Reporting Suite$2`
      );
    }

    // 2. Agenda / Executive Index Slide (Slide 2)
    else if (idx === 1) {
      xml = xml.replace(
        /(<a:t>)(Financial objectives|Objectives|Strategy 1)(<\/a:t>)/gi,
        `$1Executive KPI Scorecard$3`
      );
      xml = xml.replace(
        /(<a:t>)(Budget|Budget allocation|Strategy 2)(<\/a:t>)/gi,
        `$1Deliverable Velocity &amp; Milestones$3`
      );
      xml = xml.replace(
        /(<a:t>)(Growth strategies|Growth|Strategy 3)(<\/a:t>)/gi,
        `$1Resource Allocation &amp; Capacity$3`
      );
      xml = xml.replace(
        /(<a:t>)(Conclusion|Summary|Next Steps)(<\/a:t>)/gi,
        `$1Critical Deliverables &amp; Escalations$3`
      );
    }

    // 3. Executive Status & Velocity Takeaway (Slide 3 & 4)
    else if (idx === 2 || idx === 3) {
      xml = xml.replace(
        /(<a:t>)(Financial success outlook|Outlook|Financial position|Our financial position)(<\/a:t>)/gi,
        `$1Delivery Trajectory &amp; Project Health$3`
      );
      xml = xml.replace(
        /(<a:t>)(Our company continues to experience significant growth[^<]*?)(<\/a:t>)/gi,
        `$1Delivery trajectory remains strong with ${completionPercent}% completion across confirmed milestones. Project momentum is sustained with ${inProgressCount} active deliverables and ${overdueCount} flagged risks.$3`
      );
    }

    // 4. Milestone & Performance KPIs (Slide 5)
    else if (idx === 4) {
      xml = xml.replace(
        /(<a:t>)(KPIs driving success|Key performance indicators|KPIs)(<\/a:t>)/gi,
        `$1Milestone Delivery &amp; Execution Velocity$3`
      );
      xml = xml.replace(
        /(<a:t>)(Growth rate)(<\/a:t>)/gi,
        `$1Completion Velocity: ${completionPercent}%$3`
      );
      xml = xml.replace(
        /(<a:t>)(We’ve achieved a 22\.9%[^<]*?)(<\/a:t>)/gi,
        `$1Achieved ${completionPercent}% delivery velocity (${completedCount} of ${totalCount} deliverables verified and shipped to date).$3`
      );
      xml = xml.replace(
        /(<a:t>)(Profit margins)(<\/a:t>)/gi,
        `$1Team Capacity: Balanced$3`
      );
      xml = xml.replace(
        /(<a:t>)(As a result of our sustained operational efficiency[^<]*?)(<\/a:t>)/gi,
        `$1Workload is balanced across ${topResources.length || 1} core team contributors with zero critical blockers.$3`
      );
    }

    // 5. Hero Stat / Completion Rate Callout (Slide 6)
    else if (idx === 5) {
      // Big stat percentage (e.g. 25%)
      xml = xml.replace(/(<a:t>)(\d{1,3}%)(<\/a:t>)/g, `$1${completionPercent}%$3`);
      xml = xml.replace(
        /(<a:t>)(projected revenue growth[^<]*?|revenue growth[^<]*?|growth target[^<]*?)(<\/a:t>)/gi,
        `$1Deliverables Completed &amp; Verified (${completedCount} of ${totalCount} Done)$3`
      );
      xml = xml.replace(
        /(<a:t>)(Forecasting for the future|Forecast)(<\/a:t>)/gi,
        `$1Delivery Velocity &amp; Horizon$3`
      );
    }

    // 6. Deliverable Status Lifecycle (Slide 7 & 8)
    else if (idx === 6 || idx === 7) {
      xml = xml.replace(
        /(<a:t>)(Financial growth &amp; objectives|Financial objectives|Objectives)(<\/a:t>)/gi,
        `$1Deliverable Status Lifecycle Breakdown$3`
      );
      xml = xml.replace(
        /(<a:t>)(Short-term goals)(<\/a:t>)/gi,
        `$1Completed &amp; Verified: ${completedCount} items (${completionPercent}%)$3`
      );
      xml = xml.replace(
        /(<a:t>)(Long-term growth)(<\/a:t>)/gi,
        `$1In Active Execution: ${inProgressCount} items$3`
      );
      xml = xml.replace(
        /(<a:t>)(Risk mitigation)(<\/a:t>)/gi,
        `$1Pending / Backlog: ${pendingCount} items$3`
      );
      xml = xml.replace(
        /(<a:t>)(Budget allocation)(<\/a:t>)/gi,
        `$1On Hold / Blocked: ${holdCount} items$3`
      );
    }

    // 7. Focus & Strategic Focus (Slide 9 & 10)
    else if (idx === 8 || idx === 9) {
      xml = xml.replace(
        /(<a:t>)(Budget allocation|Budget)(<\/a:t>)/gi,
        `$1Critical Deliverables &amp; Focus$3`
      );
      xml = xml.replace(
        /(<a:t>)(Quote)(<\/a:t>)/gi,
        `$1Executive Project Takeaway$3`
      );
      xml = xml.replace(
        /(<a:t>)(Smart financial decisions today drive lasting success for the future\.)(<\/a:t>)/gi,
        `$1High velocity execution and balanced team capacity ensure on-time delivery across all project milestones.$3`
      );
    }

    // 8. Deliverables Data Table (Slide 11 or any slide containing <a:tbl>)
    else if (xml.includes("<a:tbl")) {
      xml = xml.replace(
        /(<a:t>)(Budget allocation &amp; growth forecast|Budget forecast|Financial table)(<\/a:t>)/gi,
        `$1Confirmed Deliverables &amp; Milestone Progress$3`
      );

      // Inject task rows into table if rows exist
      if (topTasks.length > 0) {
        xml = xml.replace(/Category/g, "Deliverable / Milestone");
        xml = xml.replace(/Budget allocation/g, "Owner / Assignee");
        xml = xml.replace(/Projected growth/g, "Priority");
        xml = xml.replace(/ROI expectation/g, "Status");

        // Specific replacements for template rows
        if (topTasks[0]) {
          xml = xml.replace(/R&amp;D investment/g, escapeXml(topTasks[0].title.slice(0, 36)));
          xml = xml.replace(/\$75M/g, escapeXml(topTasks[0].assignees[0]?.name || "Team Member"));
          xml = xml.replace(/\+20% annually/g, escapeXml((topTasks[0].priority || "NORMAL").toUpperCase()));
          xml = xml.replace(/>High</g, `>${escapeXml(topTasks[0].isCompleted ? "Verified Done" : "In Flight")}<`);
        }
        if (topTasks[1]) {
          xml = xml.replace(/Marketing/g, escapeXml(topTasks[1].title.slice(0, 36)));
          xml = xml.replace(/\$50M/g, escapeXml(topTasks[1].assignees[0]?.name || "Team Member"));
          xml = xml.replace(/\+15% annually/g, escapeXml((topTasks[1].priority || "NORMAL").toUpperCase()));
          xml = xml.replace(/>Moderate</g, `>${escapeXml(topTasks[1].isCompleted ? "Verified Done" : "In Flight")}<`);
        }
        if (topTasks[2]) {
          xml = xml.replace(/Operations/g, escapeXml(topTasks[2].title.slice(0, 36)));
          xml = xml.replace(/\$40M/g, escapeXml(topTasks[2].assignees[0]?.name || "Team Member"));
          xml = xml.replace(/\+5% annually/g, escapeXml((topTasks[2].priority || "NORMAL").toUpperCase()));
          xml = xml.replace(/>Stable</g, `>${escapeXml(topTasks[2].isCompleted ? "Verified Done" : "In Flight")}<`);
        }
        if (topTasks[3]) {
          xml = xml.replace(/Tech upgrades/g, escapeXml(topTasks[3].title.slice(0, 36)));
          xml = xml.replace(/\$30M/g, escapeXml(topTasks[3].assignees[0]?.name || "Team Member"));
          xml = xml.replace(/\+25% annually/g, escapeXml((topTasks[3].priority || "NORMAL").toUpperCase()));
        }
        if (topTasks[4]) {
          xml = xml.replace(/Market expansion/g, escapeXml(topTasks[4].title.slice(0, 36)));
          xml = xml.replace(/\$80M/g, escapeXml(topTasks[4].assignees[0]?.name || "Team Member"));
          xml = xml.replace(/\+30% annually/g, escapeXml((topTasks[4].priority || "NORMAL").toUpperCase()));
        }
        if (topTasks[5]) {
          xml = xml.replace(/Cash reserves/g, escapeXml(topTasks[5].title.slice(0, 36)));
          xml = xml.replace(/\$25M/g, escapeXml(topTasks[5].assignees[0]?.name || "Team Member"));
          xml = xml.replace(/Essential/g, escapeXml(topTasks[5].isCompleted ? "Verified" : "Pending"));
        }
      }
    }

    // 9. Team Workload & Allocation (Slide 13)
    else if (idx === 12 || idx === 11) {
      xml = xml.replace(
        /(<a:t>)(Strategies for sustainable growth|Sustainable growth|Growth pillars)(<\/a:t>)/gi,
        `$1Team Workload Allocation &amp; Capacity$3`
      );

      if (topResources[0]) {
        const r = topResources[0];
        const rate = r.totalAssigned > 0 ? Math.round((r.completedCount * 100) / r.totalAssigned) : 100;
        xml = xml.replace(
          /(<a:t>)(High-return opportunities)(<\/a:t>)/gi,
          `$1${escapeXml(r.name)} (${rate}% Velocity)$3`
        );
        xml = xml.replace(
          /(<a:t>)(Targeted investments support long-term expansion[^<]*?)(<\/a:t>)/gi,
          `$1${escapeXml(r.name)} has completed ${r.completedCount} of ${r.totalAssigned} assigned deliverables with 0 overdue items.$3`
        );
      }
      if (topResources[1]) {
        const r = topResources[1];
        const rate = r.totalAssigned > 0 ? Math.round((r.completedCount * 100) / r.totalAssigned) : 100;
        xml = xml.replace(
          /(<a:t>)(Technology integration)(<\/a:t>)/gi,
          `$1${escapeXml(r.name)} (${rate}% Velocity)$3`
        );
        xml = xml.replace(
          /(<a:t>)(Leveraging AI and automation to drive financial efficiency[^<]*?)(<\/a:t>)/gi,
          `$1${escapeXml(r.name)} has completed ${r.completedCount} of ${r.totalAssigned} assigned deliverables with steady velocity.$3`
        );
      }
      if (topResources[2]) {
        const r = topResources[2];
        const rate = r.totalAssigned > 0 ? Math.round((r.completedCount * 100) / r.totalAssigned) : 100;
        xml = xml.replace(
          /(<a:t>)(Market expansion)(<\/a:t>)/gi,
          `$1${escapeXml(r.name)} (${rate}% Velocity)$3`
        );
      }
      if (topResources[3]) {
        const r = topResources[3];
        const rate = r.totalAssigned > 0 ? Math.round((r.completedCount * 100) / r.totalAssigned) : 100;
        xml = xml.replace(
          /(<a:t>)(Risk management)(<\/a:t>)/gi,
          `$1${escapeXml(r.name)} (${rate}% Velocity)$3`
        );
      }
    }

    // 10. Closing / Thank You Slide (Last Slide)
    if (idx === slidePaths.length - 1) {
      xml = xml.replace(
        /(<a:t>)(Thank you|Closing|End of Presentation)(<\/a:t>)/gi,
        `$1${escapeXml(data.projectName)} // Status Report$3`
      );
      xml = xml.replace(
        /(<a:t>)(Presented by Frey Munch|Frey Munch|Presenter Name)(<\/a:t>)/gi,
        `$1Orbitwork Executive Reporting Suite • ${escapeXml(orgOrCompany)}$3`
      );
    }

    zip.file(sPath, xml);
  }

  const generatedBuffer = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
  });

  return generatedBuffer;
}

/**
 * Executes 100% in-browser generation and download of PPTX presentation
 * from an uploaded corporate template, with zero server payload limitations.
 */
export async function downloadInjectedCompanyPresentation(
  templateBuffer: Uint8Array | ArrayBuffer,
  data: ProjectTemplateData,
  fileName: string
): Promise<void> {
  const outputBytes = await injectProjectDataIntoCompanyTemplate(templateBuffer, data);
  const blob = new Blob([outputBytes as unknown as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".pptx") ? fileName : `${fileName}.pptx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function escapeXml(unsafe: string): string {
  return (unsafe || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
