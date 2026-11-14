export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  category: "Releases" | "Product" | "Engineering" | "Security";
  date: string;
  readTime: string;
  author: {
    name: string;
    role: string;
  };
  content: {
    lead: string;
    sections: Array<{
      heading?: string;
      body: string[];
    }>;
  };
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "orbitwork-2-0-release",
    title: "Introducing OrbitWork 2.0: Unified Workspaces, Real-Time Docs & Advanced Gantt",
    description: "Today we are launching OrbitWork 2.0, our biggest platform release featuring unified project workspaces, collaborative documentation, and intelligent timeline planning.",
    category: "Releases",
    date: "November 12, 2026",
    readTime: "4 min read",
    author: {
      name: "OrbitWork Product Team",
      role: "Platform Engineering",
    },
    content: {
      lead: "OrbitWork 2.0 brings project coordination, collaborative documentation, and sprint tracking together into one blazing-fast workspace designed for high-velocity teams.",
      sections: [
        {
          heading: "A New Standard for Workspace Coordination",
          body: [
            "Modern engineering and product teams are tired of juggling three different tools just to keep a sprint moving. OrbitWork 2.0 unifies task management, real-time documentation, and sprint timelines in a single intuitive experience.",
            "With fluid multi-workspace switching and streamlined role-based permissions, teams can move between strategic roadmaps and daily execution without friction.",
          ],
        },
        {
          heading: "Interactive Gantt Timelines & Milestone Tracking",
          body: [
            "We have completely rebuilt the Gantt chart engine from the ground up. You can now visually map dependencies, auto-schedule task blocks, and identify critical path bottlenecks before they delay your release.",
            "Milestones snap to deliverables automatically, giving stakeholders full visibility into project health without manual status reporting.",
          ],
        },
        {
          heading: "What's Next",
          body: [
            "OrbitWork 2.0 is live for all customers starting today. We are already preparing our upcoming AI sprint assistant and webhook automation integrations, scheduled for late Q4.",
          ],
        },
      ],
    },
  },
  {
    slug: "responsive-ui-upgrade",
    title: "Building a Seamless Cross-Device Experience: The Global Responsive Overhaul",
    description: "How our design and engineering team overhauled OrbitWork's interface to deliver flawless layouts across desktops, laptops, tablets, and mobile devices.",
    category: "Engineering",
    date: "November 5, 2026",
    readTime: "5 min read",
    author: {
      name: "Frontend Systems Team",
      role: "UI/UX Architecture",
    },
    content: {
      lead: "From 24-inch dual monitors down to 13-inch ultraportables and mobile phones, here is how we restructured OrbitWork's layout engine for peak responsiveness.",
      sections: [
        {
          heading: "Fluid Viewports Over Fixed Widths",
          body: [
            "Fixed-pixel layouts often fail when users transition between external displays and laptop screens. In this engineering deep-dive, we share our transition to CSS clamp(), responsive grid tracks, and flexible container queries.",
            "By replacing rigid pixel constraints with fluid layout tokens, every card, table, and dashboard panel scales proportionally without truncating vital team data.",
          ],
        },
        {
          heading: "Adaptive Navigation and Mobile Drawers",
          body: [
            "We introduced an intelligent collapsible navigation drawer that automatically minimizes on compact screens while retaining full keyboard accessibility (Ctrl + K) and quick-search capabilities.",
          ],
        },
      ],
    },
  },
  {
    slug: "subdomains-and-developer-ecosystem",
    title: "Dedicated Subdomains & Developer Infrastructure: App, Docs, Support, Status, and API",
    description: "OrbitWork is splitting into dedicated subdomain portals to deliver purpose-built performance, isolated routing, and developer-first REST endpoints.",
    category: "Product",
    date: "October 28, 2026",
    readTime: "3 min read",
    author: {
      name: "Infrastructure Team",
      role: "Platform Architecture",
    },
    content: {
      lead: "To provide the best possible experience for users, developers, and visitors, OrbitWork now routes each sub-service to its own dedicated subdomain.",
      sections: [
        {
          heading: "Subdomain Architecture Overview",
          body: [
            "Our main marketing experience lives on www.orbitwork.org, while active users work inside app.orbitwork.org. Developers can interact with api.orbitwork.org, and customer assistance is centralized at docs.orbitwork.org and support.orbitwork.org.",
            "Our live operational metrics are now continuously published at status.orbitwork.org, giving teams real-time visibility into uptime and service latency.",
          ],
        },
        {
          heading: "Edge-Powered Routing",
          body: [
            "Routing decisions execute at the edge with zero additional latency. Subdomain rewrites keep URLs canonical and clean while sharing a unified Next.js backend infrastructure.",
          ],
        },
      ],
    },
  },
  {
    slug: "enterprise-security-and-compliance",
    title: "Strengthening Enterprise Security: RBAC, Session Protection & Row-Level Security",
    description: "A comprehensive look at OrbitWork's multi-layered security model, tenant isolation, and Supabase Row-Level Security policies.",
    category: "Security",
    date: "October 14, 2026",
    readTime: "6 min read",
    author: {
      name: "Security & Compliance Team",
      role: "Information Security",
    },
    content: {
      lead: "Enterprise trust starts with rigorous data isolation. Learn how OrbitWork enforces strict security boundaries across every workspace.",
      sections: [
        {
          heading: "Defense in Depth with Row-Level Security",
          body: [
            "Every database query executed in OrbitWork is evaluated against fine-grained Postgres Row-Level Security (RLS) policies. Even if an API request lacks explicit filtering, the database engine guarantees that tenant data remains isolated.",
            "We pair RLS with cryptographic session tokens and secure HTTP-only cookies that survive subdomain rewriting seamlessly.",
          ],
        },
        {
          heading: "Continuous Auditing & Monitoring",
          body: [
            "All administrative operations, workspace membership modifications, and data export events are logged with immutable audit trails to ensure compliance with SOC 2 and GDPR guidelines.",
          ],
        },
      ],
    },
  },
];
