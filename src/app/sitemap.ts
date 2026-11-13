import type { MetadataRoute } from "next";
import { buildCanonicalUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-11-13T00:00:00.000Z");

  return [
    {
      url: buildCanonicalUrl("/"),
      lastModified,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: buildCanonicalUrl("/free-project-management-software"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: buildCanonicalUrl("/project-management-software"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: buildCanonicalUrl("/jira-alternative"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: buildCanonicalUrl("/free-jira-alternative"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: buildCanonicalUrl("/asana-alternative"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: buildCanonicalUrl("/clickup-alternative"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: buildCanonicalUrl("/monday-alternative"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: buildCanonicalUrl("/services"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: buildCanonicalUrl("/services/project-management"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: buildCanonicalUrl("/projects-case-studies"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: buildCanonicalUrl("/about"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: buildCanonicalUrl("/contact"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: buildCanonicalUrl("/privacy"),
      lastModified,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: buildCanonicalUrl("/terms"),
      lastModified,
      changeFrequency: "yearly",
      priority: 0.4,
    },
  ];
}
