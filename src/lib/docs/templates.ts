// src/lib/docs/templates.ts
import type { DocTemplate } from "./types.ts";

export const DOC_TEMPLATES: DocTemplate[] = [
  {
    id: "prd",
    title: "Product Requirements Document",
    description: "Define product objectives, user personas, features, user stories, and acceptance criteria.",
    icon: "📋",
    category: "Product",
    initialPages: [
      {
        title: "PRD Overview & Goals",
        icon: "🎯",
        blocks: [
          { id: "b1", type: "heading_1", data: { text: "Product Requirements Document (PRD)" } },
          { id: "b2", type: "callout", data: { calloutType: "info", icon: "💡", text: "A single source of truth for problem statement, target audience, KPIs, and scope boundaries." } },
          { id: "b3", type: "heading_2", data: { text: "1. Problem Statement" } },
          { id: "b4", type: "paragraph", data: { text: "Explain the user pain points, market opportunity, and why we are building this product now." } },
          { id: "b5", type: "heading_2", data: { text: "2. Target Personas" } },
          {
            id: "b6",
            type: "table",
            data: {
              rows: [
                ["Persona", "Primary Need", "Current Friction", "Value Proposition"],
                ["Product Lead", "Clarity across distributed sprints", "Siloed documents & tasks", "Unified connected knowledge layer"],
                ["Engineering Team", "Precise acceptance criteria & schemas", "Stale specs in chat channels", "Living synchronized documentation"],
              ],
            },
          },
          { id: "b7", type: "heading_2", data: { text: "3. Success Metrics (KPIs)" } },
          { id: "b8", type: "checklist", data: { text: "Achieve > 80% weekly active documentation engagement", checked: false } },
          { id: "b9", type: "checklist", data: { text: "Reduce project discovery onboarding time from 4 days to 4 hours", checked: false } },
        ],
        subpages: [
          {
            title: "Feature Specifications",
            icon: "✨",
            blocks: [
              { id: "sb1", type: "heading_1", data: { text: "Feature Specifications & User Stories" } },
              { id: "sb2", type: "heading_2", data: { text: "Functional Scope" } },
              { id: "sb3", type: "checklist", data: { text: "User Story 1: As an author, I can create nested subpages with drag-and-drop.", checked: true } },
              { id: "sb4", type: "checklist", data: { text: "User Story 2: As a teammate, I can highlight text and add threaded inline comments.", checked: false } },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "srs",
    title: "Software Requirements Specification",
    description: "System capabilities, external interfaces, non-functional performance, and compliance rules.",
    icon: "⚙️",
    category: "Engineering",
    initialPages: [
      {
        title: "Software Requirements Specification",
        icon: "⚙️",
        blocks: [
          { id: "srs1", type: "heading_1", data: { text: "Software Requirements Specification (SRS)" } },
          { id: "srs2", type: "callout", data: { calloutType: "neutral", icon: "📌", text: "Compliant with industry standard software engineering specification guidelines." } },
          { id: "srs3", type: "heading_2", data: { text: "1. Scope of Work & System Boundaries" } },
          { id: "srs4", type: "paragraph", data: { text: "Describe system interfaces, client devices, external SaaS dependencies, and operational limits." } },
          { id: "srs5", type: "heading_2", data: { text: "2. Non-Functional Requirements" } },
          {
            id: "srs6",
            type: "table",
            data: {
              rows: [
                ["Category", "Target Metric", "Verification Strategy"],
                ["Latency", "P95 API response under 120ms", "Synthetic load benchmarking"],
                ["Security", "Strict Server-Side RLS & XSS Sanitization", "Automated regression tests"],
                ["Availability", "99.9% uptime target", "Regional high-availability clusters"],
              ],
            },
          },
        ],
      },
    ],
  },
  {
    id: "tech-spec",
    title: "Technical Specification",
    description: "Detailed system design, data flow diagrams, edge case handling, and deployment plans.",
    icon: "🔬",
    category: "Engineering",
    initialPages: [
      {
        title: "Technical Specification",
        icon: "🔬",
        blocks: [
          { id: "ts1", type: "heading_1", data: { text: "Technical Specification" } },
          { id: "ts2", type: "callout", data: { calloutType: "tip", icon: "🚀", text: "Technical blueprint reviewed and signed off before code implementation starts." } },
          { id: "ts3", type: "heading_2", data: { text: "Proposed Solution Architecture" } },
          { id: "ts4", type: "paragraph", data: { text: "Provide detailed component models, state machines, and concurrency considerations." } },
          { id: "ts5", type: "heading_2", data: { text: "Code Example / Interface Signature" } },
          { id: "ts6", type: "code", data: { language: "typescript", text: "interface PageListingNode {\n  id: string;\n  docId: string;\n  parentPageId: string | null;\n  title: string;\n  position: number;\n  hasChildren: boolean;\n}" } },
        ],
      },
    ],
  },
  {
    id: "architecture",
    title: "Architecture Document",
    description: "High-level architectural blueprints, infrastructure topology, microservices, and databases.",
    icon: "🏛️",
    category: "Architecture",
    initialPages: [
      {
        title: "System Architecture",
        icon: "🏛️",
        blocks: [
          { id: "arch1", type: "heading_1", data: { text: "System Architecture & Infrastructure" } },
          { id: "arch2", type: "callout", data: { calloutType: "info", icon: "🌐", text: "Complete architecture overview across Client, Edge, Serverless App Router, and Postgres Database." } },
          { id: "arch3", type: "heading_2", data: { text: "Tier Breakdown" } },
          { id: "arch4", type: "bullet_list", data: { text: "Frontend: Next.js 15 App Router, React 19 Client & Server Components" } },
          { id: "arch5", type: "bullet_list", data: { text: "Storage: S3-compatible attachments & Supabase asset buckets" } },
          { id: "arch6", type: "bullet_list", data: { text: "Database: Cloud PostgreSQL with Row Level Security (RLS)" } },
        ],
      },
    ],
  },
  {
    id: "api-doc",
    title: "API Documentation",
    description: "RESTful endpoint specifications, request/response bodies, status codes, and auth headers.",
    icon: "🔌",
    category: "Engineering",
    initialPages: [
      {
        title: "API Specification",
        icon: "🔌",
        blocks: [
          { id: "api1", type: "heading_1", data: { text: "API Documentation & Endpoints" } },
          { id: "api2", type: "callout", data: { calloutType: "neutral", icon: "🔑", text: "Base URL: /api/workspaces/{workspace_id}/docs" } },
          { id: "api3", type: "heading_2", data: { text: "Page Listing Endpoint" } },
          { id: "api4", type: "code", data: { language: "bash", text: "GET /api/workspaces/{workspace_id}/docs/{doc_id}/page_listing\nAuthorization: Bearer <session_token>" } },
          {
            id: "api5",
            type: "table",
            data: {
              rows: [
                ["Parameter", "Type", "Location", "Description"],
                ["workspace_id", "UUID", "Path", "Workspace identifier"],
                ["doc_id", "UUID", "Path", "Target document identifier"],
              ],
            },
          },
        ],
      },
    ],
  },
  {
    id: "meeting-notes",
    title: "Meeting Notes",
    description: "Structured agenda, attendee list, discussion notes, decisions made, and follow-up action items.",
    icon: "📝",
    category: "General",
    initialPages: [
      {
        title: "Meeting Notes",
        icon: "📝",
        blocks: [
          { id: "mn1", type: "heading_1", data: { text: "Meeting Notes & Action Items" } },
          { id: "mn2", type: "callout", data: { calloutType: "info", icon: "📅", text: "Date: " + new Date().toLocaleDateString() + " · Attendees: Team Leads" } },
          { id: "mn3", type: "heading_2", data: { text: "Agenda" } },
          { id: "mn4", type: "numbered_list", data: { text: "Review sprint deliverables and milestones" } },
          { id: "mn5", type: "numbered_list", data: { text: "Resolve architecture open questions" } },
          { id: "mn6", type: "heading_2", data: { text: "Key Decisions" } },
          { id: "mn7", type: "quote", data: { text: "Agreed to adopt ClickUp-style page listing endpoints for instant sidebar loads." } },
          { id: "mn8", type: "heading_2", data: { text: "Action Items" } },
          { id: "mn9", type: "checklist", data: { text: "Implement page reorder API with fractional positioning", checked: false } },
          { id: "mn10", type: "checklist", data: { text: "Configure version history snapshot restore flow", checked: false } },
        ],
      },
    ],
  },
  {
    id: "project-plan",
    title: "Project Plan",
    description: "Milestones, sprint timelines, resource allocation, critical path dependencies, and delivery risk matrix.",
    icon: "🗺️",
    category: "Project",
    initialPages: [
      {
        title: "Project Execution Plan",
        icon: "🗺️",
        blocks: [
          { id: "pp1", type: "heading_1", data: { text: "Project Execution Plan" } },
          { id: "pp2", type: "callout", data: { calloutType: "success", icon: "🎯", text: "Target Launch: Next Quarter · Owner: Core Delivery Team" } },
          { id: "pp3", type: "heading_2", data: { text: "Key Milestones" } },
          {
            id: "pp4",
            type: "table",
            data: {
              rows: [
                ["Phase", "Milestone", "Target Date", "Status"],
                ["Phase 1", "Database Schema & Migration", "Week 1", "Complete"],
                ["Phase 2", "REST API & ClickUp Pages Spec", "Week 2", "In Progress"],
                ["Phase 3", "Interactive Hub & Block Editor", "Week 3", "Planned"],
              ],
            },
          },
        ],
      },
    ],
  },
  {
    id: "sop",
    title: "Standard Operating Procedure (SOP)",
    description: "Step-by-step standardized operations, team procedures, compliance audits, and troubleshooting runbooks.",
    icon: "📖",
    category: "Operations",
    initialPages: [
      {
        title: "Standard Operating Procedure",
        icon: "📖",
        blocks: [
          { id: "sop1", type: "heading_1", data: { text: "Standard Operating Procedure (SOP)" } },
          { id: "sop2", type: "callout", data: { calloutType: "warning", icon: "⚠️", text: "Ensure team training is validated before executing production operational tasks." } },
          { id: "sop3", type: "heading_2", data: { text: "1. Purpose and Scope" } },
          { id: "sop4", type: "paragraph", data: { text: "Standardize procedure across all regional and distributed teams." } },
          { id: "sop5", type: "heading_2", data: { text: "2. Step-by-Step Procedure" } },
          { id: "sop6", type: "numbered_list", data: { text: "Verify authentication credentials and permissions." } },
          { id: "sop7", type: "numbered_list", data: { text: "Perform pre-flight sanity checks and audit snapshot." } },
          { id: "sop8", type: "numbered_list", data: { text: "Execute deployment in staging environment first." } },
        ],
      },
    ],
  },
  {
    id: "release-notes",
    title: "Release Notes",
    description: "New features, bug fixes, breaking changes, and migration instructions for customer-facing releases.",
    icon: "🚀",
    category: "Product",
    initialPages: [
      {
        title: "Release Notes v2.0",
        icon: "🚀",
        blocks: [
          { id: "rn1", type: "heading_1", data: { text: "Release Notes - Version 2.0" } },
          { id: "rn2", type: "callout", data: { calloutType: "success", icon: "🎉", text: "Major Release: ClickUp-style Collaborative Docs & Knowledge Hub." } },
          { id: "rn3", type: "heading_2", data: { text: "🌟 What's New" } },
          { id: "rn4", type: "bullet_list", data: { text: "Nested page hierarchy with drag-and-drop reordering." } },
          { id: "rn5", type: "bullet_list", data: { text: "Interactive slash commands menu for lightning-fast block insertion." } },
          { id: "rn6", type: "bullet_list", data: { text: "Inline comment threads with instant convert-to-task workflow." } },
          { id: "rn7", type: "heading_2", data: { text: "🐛 Bug Fixes & Improvements" } },
          { id: "rn8", type: "bullet_list", data: { text: "Enhanced autosave with optimistic UI and offline retry buffer." } },
        ],
      },
    ],
  },
  {
    id: "decision-record",
    title: "Architecture Decision Record (ADR)",
    description: "Context, options evaluated, chosen decision, tradeoffs, and consequences for key architectural choices.",
    icon: "💡",
    category: "Architecture",
    initialPages: [
      {
        title: "ADR: Architecture Decision Record",
        icon: "💡",
        blocks: [
          { id: "adr1", type: "heading_1", data: { text: "ADR 001: ClickUp-Style Pages Hierarchy" } },
          { id: "adr2", type: "callout", data: { calloutType: "info", icon: "⚖️", text: "Status: Accepted · Date: " + new Date().toISOString().split("T")[0] } },
          { id: "adr3", type: "heading_2", data: { text: "Context" } },
          { id: "adr4", type: "paragraph", data: { text: "Modern collaborative documentation requires nested subpages, fast navigation tree loading, and rich block content." } },
          { id: "adr5", type: "heading_2", data: { text: "Decision" } },
          { id: "adr6", type: "quote", data: { text: "We adopt a dedicated docs container with nested doc_pages and a lightweight page_listing endpoint." } },
          { id: "adr7", type: "heading_2", data: { text: "Consequences" } },
          { id: "adr8", type: "bullet_list", data: { text: "Faster sidebar rendering with minimal network payload." } },
          { id: "adr9", type: "bullet_list", data: { text: "Zero disruption to existing project attachments or legacy documents." } },
        ],
      },
    ],
  },
  {
    id: "design-spec",
    title: "Design Specification",
    description: "Design tokens, wireframes, interaction behaviors, accessibility guidelines, and Figma asset embeds.",
    icon: "🎨",
    category: "Design",
    initialPages: [
      {
        title: "UX/UI Design Specification",
        icon: "🎨",
        blocks: [
          { id: "ds1", type: "heading_1", data: { text: "Design Specification & Tokens" } },
          { id: "ds2", type: "callout", data: { calloutType: "tip", icon: "✨", text: "Adheres to application design tokens: typography, radius, and dark/light color palettes." } },
          { id: "ds3", type: "heading_2", data: { text: "Typography & Elevation" } },
          { id: "ds4", type: "bullet_list", data: { text: "Font: Manrope for headings, DM Sans for editor prose" } },
          { id: "ds5", type: "bullet_list", data: { text: "Shadows: Soft 12px blur with subtle border line definition" } },
        ],
      },
    ],
  },
  {
    id: "incident-report",
    title: "Incident Report (Postmortem)",
    description: "Incident timeline, root cause analysis (5 Whys), impact assessment, recovery steps, and prevention backlog.",
    icon: "🚨",
    category: "Operations",
    initialPages: [
      {
        title: "Incident Postmortem",
        icon: "🚨",
        blocks: [
          { id: "ir1", type: "heading_1", data: { text: "Incident Postmortem & Root Cause Analysis" } },
          { id: "ir2", type: "callout", data: { calloutType: "warning", icon: "🔥", text: "Severity: SEV-2 · Total Downtime: 14 mins · Resolved" } },
          { id: "ir3", type: "heading_2", data: { text: "Incident Summary" } },
          { id: "ir4", type: "paragraph", data: { text: "Detail the alert trigger, symptoms observed, and impacted customer segments." } },
          { id: "ir5", type: "heading_2", data: { text: "Timeline of Events" } },
          {
            id: "ir6",
            type: "table",
            data: {
              rows: [
                ["Time (UTC)", "Event", "Actor", "Action Taken"],
                ["14:02", "Spike in 504 Gateway Timeouts", "Monitoring", "Automated alert paged on-call"],
                ["14:08", "Traffic route isolation", "DevOps", "Redirected read traffic to replica"],
                ["14:16", "Metrics normalized", "DevOps", "Incident closed, postmortem initiated"],
              ],
            },
          },
          { id: "ir7", type: "heading_2", data: { text: "Preventative Action Items" } },
          { id: "ir8", type: "checklist", data: { text: "Scale read replica connection pool capacity by 2x", checked: true } },
          { id: "ir9", type: "checklist", data: { text: "Add automated circuit breaker on external upstream services", checked: false } },
        ],
      },
    ],
  },
];
