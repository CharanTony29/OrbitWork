import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Orbitwork",
    short_name: "Orbitwork",
    description:
      "Orbitwork is a modern project management and team collaboration platform.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#167c58",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
