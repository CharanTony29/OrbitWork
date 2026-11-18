"use client";

import dynamic from "next/dynamic";

export const HowItWorksReel = dynamic(
  () => import("./HowItWorksReel").then((mod) => mod.HowItWorksReel),
  {
    ssr: true,
    loading: () => (
      <section className="hp-section hp-journey-section" id="how-it-works" aria-busy="true">
        <div className="hp-container">
          <div className="hp-lazy-skeleton" />
        </div>
      </section>
    ),
  }
);

export const ProductShowcase = dynamic(
  () => import("./ProductShowcase").then((mod) => mod.ProductShowcase),
  {
    ssr: true,
    loading: () => (
      <section className="hp-section hp-showcase-section" id="product" aria-busy="true">
        <div className="hp-container">
          <div className="hp-lazy-skeleton" />
        </div>
      </section>
    ),
  }
);

export const ProjectBrainFlow = dynamic(
  () => import("./ProjectBrainFlow").then((mod) => mod.ProjectBrainFlow),
  {
    ssr: true,
    loading: () => (
      <section className="hp-section hp-brain-section" id="ai-project-brain" aria-busy="true">
        <div className="hp-container">
          <div className="hp-lazy-skeleton hp-lazy-skeleton-dark" />
        </div>
      </section>
    ),
  }
);
