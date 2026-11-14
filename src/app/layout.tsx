import type { Metadata } from "next";
import { CANONICAL_ORIGIN } from "@/lib/seo";
import "./globals.css";
import "./theme.css";
import "./responsive-layout.css";
import "./homepage.css";
import ThemePicker from "./ThemePicker";
import ChatNotificationListener from "./ChatNotificationListener";
import AuthRecoveryListener from "./AuthRecoveryListener";
import TopProgressBar from "./TopProgressBar";
import GlobalMobileDrawer from "./GlobalMobileDrawer";

export const metadata: Metadata = {
  metadataBase: new URL(CANONICAL_ORIGIN),
  title: {
    default: "Orbitwork — Project Management & Work Management Software",
    template: "%s | Orbitwork",
  },
  description:
    "Orbitwork is modern project management and work management software featuring Kanban boards, Gantt charts, task sheets, time tracking, team chat, docs, and cloud storage.",
  applicationName: "Orbitwork",
  icons: {
    icon: [
      { url: "/icon-48.png", type: "image/png", sizes: "48x48" },
    ],
    apple: [{ url: "/apple-touch-icon.png?v=3", type: "image/png", sizes: "180x180" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="system">
      <head>
        <link rel="preload" href="/logo-64.png?v=3" as="image" type="image/png" />
      </head>
      <body>
        <TopProgressBar />
        {children}
        <GlobalMobileDrawer />
        <ThemePicker />
        <ChatNotificationListener />
        <AuthRecoveryListener />
      </body>
    </html>
  );
}
