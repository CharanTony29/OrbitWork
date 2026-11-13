import type { MetadataRoute } from "next";
import { CANONICAL_ORIGIN } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const commonDisallow = [
    "/api/",
    "/auth/",
    "/dashboard",
    "/my-dashboard",
    "/inbox",
    "/chat",
    "/profile",
    "/organizations/",
    "/workspaces/",
    "/projects/",
    "/invite/",
    "/reset-password",
  ];

  const commonAllow = [
    "/",
    "/free-project-management-software",
    "/project-management-software",
    "/jira-alternative",
    "/free-jira-alternative",
    "/asana-alternative",
    "/clickup-alternative",
    "/monday-alternative",
    "/about",
    "/services",
    "/services/project-management",
    "/projects-case-studies",
    "/contact",
    "/privacy",
    "/terms",
    "/login",
    "/signup",
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: commonAllow,
        disallow: commonDisallow,
      },
      // Explicitly ensure AI search bots (e.g. OpenAI Search / ChatGPT Search) can index public marketing pages
      {
        userAgent: "OAI-SearchBot",
        allow: commonAllow,
        disallow: commonDisallow,
      },
      {
        userAgent: "ChatGPT-User",
        allow: commonAllow,
        disallow: commonDisallow,
      },
      {
        userAgent: "Google-Extended",
        allow: commonAllow,
        disallow: commonDisallow,
      },
    ],
    sitemap: `${CANONICAL_ORIGIN}/sitemap.xml`,
    host: CANONICAL_ORIGIN,
  };
}
