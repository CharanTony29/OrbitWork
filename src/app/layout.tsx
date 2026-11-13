import type { Metadata } from "next";
import { CANONICAL_ORIGIN } from "@/lib/seo";
import "./globals.css";
import "./modules.css";
import "./modules-base.css";
import "./project-admin.css";
import "./task-sheet.css";
import "./task-detail.css";
import "./custom-fields.css";
import "./task-relationships.css";
import "./project-views.css";
import "./time-tracking.css";
import "./inbox.css";
import "./advanced-views.css";
import "./documents.css";
import "./project-metrics.css";
import "./timesheets.css";
import "./people-calendar.css";
import "./activity.css";
import "./integrations.css";
import "./attachments.css";
import "./reports.css";
import "./organizations.css";
import "./hierarchy-navigation.css";
import "./theme.css";
import "./profile/profile.css";
import "./workspace-access.css";
import "./responsive-layout.css";
import "./overview.css";
import "./chat/chat.css";
import "./homepage.css";
import ThemePicker from "./ThemePicker";
import ChatNotificationListener from "./ChatNotificationListener";
import AuthRecoveryListener from "./AuthRecoveryListener";
import TopProgressBar from "./TopProgressBar";

export const metadata: Metadata = {
  metadataBase: new URL(CANONICAL_ORIGIN),
  title: {
    default: "Orbitwork | Project Management & Team Collaboration Platform",
    template: "%s | Orbitwork",
  },
  description:
    "Orbitwork is a modern project management and work execution platform featuring Kanban boards, Gantt timelines, time tracking, team chat, docs, and cloud storage.",
  applicationName: "Orbitwork",
  icons: {
    icon: [
      { url: "/favicon.ico?v=3", sizes: "any" },
      { url: "/icon-48.png?v=3", type: "image/png", sizes: "48x48" },
      { url: "/icon-96.png?v=3", type: "image/png", sizes: "96x96" },
      { url: "/icon-192.png?v=3", type: "image/png", sizes: "192x192" },
    ],
    shortcut: ["/favicon.ico?v=3"],
    apple: [{ url: "/apple-touch-icon.png?v=3", type: "image/png", sizes: "180x180" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="system">
      <body>
        <TopProgressBar />
        {children}
        <ThemePicker />
        <ChatNotificationListener />
        <AuthRecoveryListener />
      </body>
    </html>
  );
}
