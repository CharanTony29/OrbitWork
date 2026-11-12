import test from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_HOME_URL,
  CANONICAL_ORIGIN,
  buildCanonicalUrl,
  buildPublicMetadata,
  normalizeAppOrigin,
} from "../seo.ts";

test("normalizeAppOrigin forces all orbitwork.org variants to https://www.orbitwork.org", () => {
  assert.equal(normalizeAppOrigin("http://orbitwork.org/"), CANONICAL_ORIGIN);
  assert.equal(normalizeAppOrigin("https://orbitwork.org/"), CANONICAL_ORIGIN);
  assert.equal(normalizeAppOrigin("http://www.orbitwork.org/"), CANONICAL_ORIGIN);
  assert.equal(normalizeAppOrigin("https://www.orbitwork.org/"), CANONICAL_ORIGIN);
  assert.equal(normalizeAppOrigin("http://localhost:3000/"), "http://localhost:3000");
  assert.equal(normalizeAppOrigin(undefined), "http://localhost:3000");
});

test("buildCanonicalUrl builds exact canonical URLs under https://www.orbitwork.org", () => {
  assert.equal(buildCanonicalUrl("/"), CANONICAL_HOME_URL);
  assert.equal(buildCanonicalUrl(""), CANONICAL_HOME_URL);
  assert.equal(buildCanonicalUrl("/services"), "https://www.orbitwork.org/services");
  assert.equal(
    buildCanonicalUrl("services/project-management/"),
    "https://www.orbitwork.org/services/project-management"
  );
  assert.equal(buildCanonicalUrl("/about/"), "https://www.orbitwork.org/about");
});

test("buildPublicMetadata populates title, description, canonical, and OpenGraph cleanly", () => {
  const meta = buildPublicMetadata({
    title: "Orbitwork | Project Management & Team Collaboration Platform",
    absoluteTitle: true,
    description: "Modern project management and team collaboration platform.",
    path: "/",
  });

  assert.deepEqual(meta.title, {
    absolute: "Orbitwork | Project Management & Team Collaboration Platform",
  });
  assert.equal(
    meta.description,
    "Modern project management and team collaboration platform."
  );
  assert.equal(meta.alternates?.canonical, "https://www.orbitwork.org/");
  assert.equal(meta.openGraph?.url, "https://www.orbitwork.org/");
});
