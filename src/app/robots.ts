import type { MetadataRoute } from "next";
import { CANONICAL_ORIGIN } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/about",
          "/services",
          "/services/plm-engineering",
          "/projects-case-studies",
          "/contact",
          "/privacy",
          "/terms",
          "/login",
          "/signup",
        ],
        disallow: [
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
        ],
      },
    ],
    sitemap: `${CANONICAL_ORIGIN}/sitemap.xml`,
    host: CANONICAL_ORIGIN,
  };
}
