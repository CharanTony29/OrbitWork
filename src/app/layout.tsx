import type { Metadata } from "next";
import { CANONICAL_ORIGIN } from "@/lib/seo";
import "./globals.css";
import "./theme.css";
import "./responsive-layout.css";
import "./homepage.css";
import "./ai/ai-polish.css";
import "./ai/ai-chat.css";
import "./ai/ai-agent.css";
import "./projects/[projectId]/brain/brain.css";
import "./interaction-feedback.css";
import ThemePicker from "./ThemePicker";
import ChatNotificationListener from "./ChatNotificationListener";
import AuthRecoveryListener from "./AuthRecoveryListener";
import TopProgressBar from "./TopProgressBar";
import GlobalInteractionFeedback from "./GlobalInteractionFeedback";
import GlobalMobileDrawer from "./GlobalMobileDrawer";
import AIChatDrawer from "./ai/AIChatDrawer";
import AIAgentGlobalNotifier from "./ai/AIAgentGlobalNotifier";

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
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("orbitwork-theme")||localStorage.getItem("color-scheme")||"system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var root=document.documentElement;root.setAttribute("data-color-scheme",d?"dark":"light");root.setAttribute("data-theme",t);if(d){root.classList.add("dark")}else{root.classList.remove("dark")}var u=localStorage.getItem("orbitwork_user_theme_v2");if(u){var p=JSON.parse(u);var c=d?p.dark:p.light;if(c){if(c.accentColor){root.style.setProperty("--green",c.accentColor);root.style.setProperty("--rail-hover",c.accentColor)}if(c.accentDarkColor){root.style.setProperty("--green-dark",c.accentDarkColor);if(!d){root.style.setProperty("--rail-bg",c.accentDarkColor);root.style.setProperty("--rail-line",c.accentDarkColor)}}if(c.fontFamily&&c.fontFamily!=="inherit"){root.style.setProperty("--app-font-family",c.fontFamily)}if(c.fontScale){root.style.fontSize=(14*c.fontScale)+"px"}if(c.statusColors){root.style.setProperty("--status-new",c.statusColors.new);root.style.setProperty("--status-progress",c.statusColors.inProgress);root.style.setProperty("--status-hold",c.statusColors.hold);root.style.setProperty("--status-review",c.statusColors.review);root.style.setProperty("--status-done",c.statusColors.done);root.style.setProperty("--status-reopen",c.statusColors.reopen)}}}}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <TopProgressBar />
        <GlobalInteractionFeedback />
        {children}
        <GlobalMobileDrawer />
        <ThemePicker />
        <ChatNotificationListener />
        <AuthRecoveryListener />
        <AIChatDrawer />
        <AIAgentGlobalNotifier />
      </body>
    </html>
  );
}
