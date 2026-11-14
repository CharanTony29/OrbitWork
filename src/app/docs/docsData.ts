export interface DocArticle {
  slug: string;
  title: string;
  category: string;
  description: string;
  content: string;
}

export const DOC_CATEGORIES = [
  {
    title: "Getting Started",
    items: [
      { slug: "getting-started", title: "Introduction & Quickstart" },
      { slug: "organizations-and-workspaces", title: "Organizations & Workspaces" },
      { slug: "inviting-members", title: "Members, Roles & Permissions" },
    ],
  },
  {
    title: "Project Management",
    items: [
      { slug: "kanban-boards", title: "Kanban Boards & Statuses" },
      { slug: "gantt-timelines", title: "Gantt Charts & Dependencies" },
      { slug: "task-sheets", title: "Interactive Task Sheets" },
      { slug: "custom-fields", title: "Custom Fields & Tags" },
    ],
  },
  {
    title: "Time & Collaboration",
    items: [
      { slug: "time-tracking", title: "Time Tracking & Timesheets" },
      { slug: "team-chat", title: "Channels & Direct Chat" },
      { slug: "docs-editor", title: "Rich Documents & Whiteboards" },
      { slug: "cloud-storage", title: "Google Drive & OneDrive" },
    ],
  },
  {
    title: "API & Developers",
    items: [
      { slug: "api-overview", title: "REST API Overview" },
      { slug: "api-health", title: "Health & Monitoring" },
      { slug: "webhooks", title: "Webhooks & Automation" },
    ],
  },
];

export const DOC_ARTICLES: Record<string, DocArticle> = {
  "getting-started": {
    slug: "getting-started",
    category: "Getting Started",
    title: "Getting Started with OrbitWork",
    description: "Learn how to get up and running with OrbitWork in less than 5 minutes.",
    content: `
      OrbitWork is an all-in-one project management and team collaboration platform designed for high-velocity teams.

      ### 1. Create your Organization
      When you first sign in at \`app.orbitwork.org\`, you'll be prompted to set up your primary organization. An organization serves as your company or team boundary, securing your data and access hierarchy.

      ### 2. Set Up Workspaces
      Within your organization, create dedicated workspaces for departments, client engagements, or product domains. Each workspace maintains its own projects, members, and storage integrations.

      ### 3. Add Projects & Tasks
      Start by creating a project with your desired workflow (Backlog, To Do, In Progress, Review, Done). You can switch between Kanban boards, Gantt timelines, interactive spreadsheet sheets, and calendars anytime.

      ### 4. Invite Team Members
      Add team members via email with granular roles: Owner, Admin, Member, or Guest.
    `,
  },
  "organizations-and-workspaces": {
    slug: "organizations-and-workspaces",
    category: "Getting Started",
    title: "Organizations & Workspaces",
    description: "Understand the multi-tenant hierarchy that powers OrbitWork.",
    content: `
      OrbitWork is built on a clean 3-tier hierarchy:
      **Organization → Workspaces → Projects & Tasks**.

      ### Organizations
      - The top-level entity representing your company or agency.
      - Holds member directory, billing, company holidays, and integrations.

      ### Workspaces
      - Functional units within an organization (e.g., "Engineering", "Marketing", "Client Acme").
      - Controls storage providers, timesheets, and project groups.
      - Members can be scoped to specific workspaces with different access permissions.
    `,
  },
  "kanban-boards": {
    slug: "kanban-boards",
    category: "Project Management",
    title: "Kanban Boards & Custom Statuses",
    description: "Visual task management with customizable workflows and status columns.",
    content: `
      OrbitWork's Kanban view gives you a fluid drag-and-drop board for your tasks.

      ### Customizing Workflow Columns
      - Click **Add Status** to create new workflow stages.
      - Assign distinct color badges and categorize statuses into Backlog, Active, or Completed.
      - Drag tasks between columns to update their status instantly in real time.

      ### Task Details Drawer
      Click any task card to open the detail panel, where you can assign teammates, track estimates, log comments, attach files, and view audit history.
    `,
  },
  "gantt-timelines": {
    slug: "gantt-timelines",
    category: "Project Management",
    title: "Gantt Charts & Dependencies",
    description: "Schedule milestones, monitor dependencies, and track project velocity.",
    content: `
      Visualize your project schedule with interactive Gantt timelines.

      ### Key Capabilities
      - **Timeline Zoom**: Switch effortlessly between Day, Week, and Month scales.
      - **Dependencies**: Link tasks with Finish-to-Start or Start-to-Start relationships.
      - **Holiday Overlays**: Integrated with your organization's holiday calendar so non-working days are automatically visible.
    `,
  },
  "time-tracking": {
    slug: "time-tracking",
    category: "Time & Collaboration",
    title: "Time Tracking & Timesheets",
    description: "Accurately capture billable hours, track task estimates, and export timesheets.",
    content: `
      Track team hours directly on tasks without switching to external timer tools.

      ### Live Timer & Manual Logging
      - Start a one-click timer directly on any task or sheet row.
      - Mark hours as billable or non-billable.
      - Review and approve timesheets at \`app.orbitwork.org/workspaces/[id]/timesheets\`.
      - Export timesheet reports to CSV for payroll and invoicing.
    `,
  },
  "api-overview": {
    slug: "api-overview",
    category: "API & Developers",
    title: "OrbitWork REST API Overview",
    description: "Programmatic access to tasks, projects, and workspaces via the OrbitWork API.",
    content: `
      OrbitWork exposes a modern REST API on \`https://api.orbitwork.org\`.

      ### Base URL
      \`https://api.orbitwork.org\`

      ### Health Endpoint
      Check service health anytime:
      \`GET https://api.orbitwork.org/health\`

      Returns HTTP 200 with JSON payload:
      \`\`\`json
      {
        "status": "ok",
        "service": "Orbitwork API",
        "timestamp": "2026-11-14T03:00:00.000Z",
        "version": "1.0.0"
      }
      \`\`\`

      ### Authentication
      Include your authorization header:
      \`Authorization: Bearer <API_KEY>\`
    `,
  },
};
