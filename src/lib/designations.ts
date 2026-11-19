export interface OrganizationDesignation {
  id?: string;
  organization_id?: string;
  name: string;
  category: "Executive" | "Management" | "HR" | "Engineering" | "Testing/QA" | "Support" | "Operations" | "Custom";
  hierarchy_level: number; // 1: C-Suite (CEO/COO), 2: Director/VP, 3: Manager/HR, 4: Lead, 5: Senior, 6: Mid (Dev/Tester/Support), 7: Junior
  description: string;
  color: string;
}

export const DEFAULT_DESIGNATIONS: OrganizationDesignation[] = [
  {
    name: "CEO",
    category: "Executive",
    hierarchy_level: 1,
    description: "Chief Executive Officer — Top-level executive leadership & strategic oversight.",
    color: "#7e22ce",
  },
  {
    name: "COO",
    category: "Executive",
    hierarchy_level: 1,
    description: "Chief Operating Officer — Global operational execution and cross-functional leadership.",
    color: "#6b21a8",
  },
  {
    name: "CTO",
    category: "Executive",
    hierarchy_level: 1,
    description: "Chief Technology Officer — Architecture, engineering vision and technical governance.",
    color: "#4f46e5",
  },
  {
    name: "HR Director",
    category: "HR",
    hierarchy_level: 2,
    description: "Director of Human Resources — Talent acquisition, employee success, and organizational policies.",
    color: "#ec4899",
  },
  {
    name: "HR Manager",
    category: "HR",
    hierarchy_level: 3,
    description: "Human Resources Manager — Team welfare, onboarding, leave administration, and HR workflows.",
    color: "#db2777",
  },
  {
    name: "Engineering Manager",
    category: "Management",
    hierarchy_level: 3,
    description: "Engineering Manager — Engineering sprints, deliverable delivery, and technical team mentorship.",
    color: "#2563eb",
  },
  {
    name: "Product Manager",
    category: "Management",
    hierarchy_level: 3,
    description: "Product Manager — Product strategy, roadmap planning, and feature requirements.",
    color: "#0284c7",
  },
  {
    name: "Lead Developer",
    category: "Engineering",
    hierarchy_level: 4,
    description: "Lead Developer — Technical lead responsible for code quality, system design, and execution.",
    color: "#0891b2",
  },
  {
    name: "Senior Developer",
    category: "Engineering",
    hierarchy_level: 5,
    description: "Senior Developer — Core feature development, system optimization, and technical implementations.",
    color: "#10b981",
  },
  {
    name: "Developer",
    category: "Engineering",
    hierarchy_level: 6,
    description: "Software Developer — Fullstack, backend, or frontend engineering deliverables.",
    color: "#059669",
  },
  {
    name: "QA Lead",
    category: "Testing/QA",
    hierarchy_level: 4,
    description: "QA Lead — Test strategy, release gates, automated verification, and quality standards.",
    color: "#b45309",
  },
  {
    name: "Tester",
    category: "Testing/QA",
    hierarchy_level: 6,
    description: "QA Tester — Manual and automated testing, defect verification, and regression suites.",
    color: "#d97706",
  },
  {
    name: "DevOps Engineer",
    category: "Engineering",
    hierarchy_level: 5,
    description: "DevOps & Infrastructure — Cloud deployment, CI/CD pipelines, and platform reliability.",
    color: "#6366f1",
  },
  {
    name: "Support Lead",
    category: "Support",
    hierarchy_level: 4,
    description: "Customer Support Lead — Client escalations, SLA compliance, and helpdesk management.",
    color: "#c2410c",
  },
  {
    name: "Support Specialist",
    category: "Support",
    hierarchy_level: 6,
    description: "Technical Support — Troubleshooting client issues, bug triage, and assistance.",
    color: "#ea580c",
  },
  {
    name: "Administrator",
    category: "Operations",
    hierarchy_level: 3,
    description: "System & Organization Administrator — Permissions, security, workspace and tenant configuration.",
    color: "#475569",
  },
];

/**
 * Normalizes member designations into a clean array of trimmed designations.
 * Handles both array columns and legacy comma-separated text strings.
 */
export function normalizeMemberDesignations(
  rawDesignations?: string[] | string | null,
  fallbackSingle?: string | null
): string[] {
  const result = new Set<string>();

  if (Array.isArray(rawDesignations)) {
    for (const d of rawDesignations) {
      if (typeof d === "string" && d.trim()) {
        result.add(d.trim());
      }
    }
  } else if (typeof rawDesignations === "string" && rawDesignations.trim()) {
    for (const part of rawDesignations.split(/[,;/]+/)) {
      if (part.trim()) result.add(part.trim());
    }
  }

  if (typeof fallbackSingle === "string" && fallbackSingle.trim()) {
    for (const part of fallbackSingle.split(/[,;/]+/)) {
      if (part.trim()) result.add(part.trim());
    }
  }

  return Array.from(result);
}

/**
 * Checks whether user has a specific designation or category of role
 * (e.g. "developer", "tester", "support", "admin", "hr", "manager", "ceo").
 */
export function memberMatchesRole(
  memberDesignations: string[],
  targetRoleKeyword: string
): boolean {
  const kw = targetRoleKeyword.toLowerCase().trim();
  return memberDesignations.some((d) => {
    const dLower = d.toLowerCase();
    if (dLower === kw) return true;
    if (kw === "developer" && (dLower.includes("dev") || dLower.includes("engineer") || dLower.includes("architect"))) return true;
    if (kw === "tester" && (dLower.includes("test") || dLower.includes("qa") || dLower.includes("quality"))) return true;
    if (kw === "support" && (dLower.includes("support") || dLower.includes("help") || dLower.includes("service"))) return true;
    if (kw === "admin" && (dLower.includes("admin") || dLower.includes("owner"))) return true;
    if (kw === "hr" && (dLower.includes("hr") || dLower.includes("people") || dLower.includes("human"))) return true;
    if (kw === "manager" && (dLower.includes("manager") || dLower.includes("lead") || dLower.includes("director") || dLower.includes("vp"))) return true;
    if (kw === "ceo" && (dLower.includes("ceo") || dLower.includes("chief executive"))) return true;
    if (kw === "coo" && (dLower.includes("coo") || dLower.includes("chief operating"))) return true;
    return dLower.includes(kw);
  });
}

/**
 * Verifies if task delegation between two users is role-aligned
 * (e.g. Developer to Developer, Tester to Tester, or Manager to Report).
 */
export function canDelegateRoleAligned(
  fromDesignations: string[],
  toDesignations: string[],
  taskCategory?: string
): { isAllowed: boolean; reason: string; roleMatched?: string } {
  const targetCategory = (taskCategory || "").toLowerCase();

  // If task explicitly specifies Developer / Tester / Support / HR / Admin
  if (targetCategory.includes("dev") || targetCategory.includes("code") || targetCategory.includes("bug")) {
    const isToDev = memberMatchesRole(toDesignations, "developer");
    if (isToDev) {
      return { isAllowed: true, reason: "Delegate is an eligible Developer", roleMatched: "Developer" };
    }
    return {
      isAllowed: false,
      reason: "This task requires developer skills. Please delegate to another team member with Developer designation.",
    };
  }

  if (targetCategory.includes("test") || targetCategory.includes("qa") || targetCategory.includes("verify")) {
    const isToTester = memberMatchesRole(toDesignations, "tester");
    if (isToTester) {
      return { isAllowed: true, reason: "Delegate is an eligible QA Tester", roleMatched: "Tester" };
    }
    return {
      isAllowed: false,
      reason: "This task requires QA verification. Please delegate to a team member with Tester designation.",
    };
  }

  if (targetCategory.includes("support") || targetCategory.includes("ticket") || targetCategory.includes("client")) {
    const isToSupport = memberMatchesRole(toDesignations, "support");
    if (isToSupport) {
      return { isAllowed: true, reason: "Delegate is an eligible Support Specialist", roleMatched: "Support" };
    }
  }

  // General peer-to-peer delegation: check if they share at least one designation or role category
  for (const d of fromDesignations) {
    if (memberMatchesRole(toDesignations, d)) {
      return { isAllowed: true, reason: `Shared designation: ${d}`, roleMatched: d };
    }
  }

  // If delegator is in leadership (Manager, Lead, CEO, COO) they can delegate downward
  const isLeadership = fromDesignations.some((d) =>
    memberMatchesRole([d], "manager") || memberMatchesRole([d], "ceo") || memberMatchesRole([d], "coo")
  );
  if (isLeadership) {
    return { isAllowed: true, reason: "Management delegation to team member", roleMatched: "Management" };
  }

  return {
    isAllowed: true,
    reason: "Role-flexible delegation permitted",
  };
}
