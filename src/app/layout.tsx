import type { Metadata } from "next";
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
import "./homepage.css";
import ThemePicker from "./ThemePicker";
import ChatNotificationListener from "./ChatNotificationListener";
import AuthRecoveryListener from "./AuthRecoveryListener";
import TopProgressBar from "./TopProgressBar";

export const metadata: Metadata = {
  title: "Orbitwork — Project and Work Management",
  description: "A thoughtful home for your organization’s projects and work.",
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
