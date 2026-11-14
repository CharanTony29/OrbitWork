import test from "node:test";
import assert from "node:assert/strict";
import {
  getHostInfo,
  getSubdomainOrigin,
  isAppRoute,
  type HostInfo,
} from "../subdomain.ts";

function createMockRequest(host: string, proto = "https") {
  const headers = new Map<string, string>([
    ["host", host],
    ["x-forwarded-host", host],
    ["x-forwarded-proto", proto],
  ]);

  return {
    headers: {
      get: (key: string) => headers.get(key.toLowerCase()) || null,
    },
    nextUrl: {
      hostname: host.split(":")[0],
      protocol: `${proto}:`,
    },
  } as any;
}

test("getHostInfo classifies production orbitwork.org subdomains correctly", () => {
  // Apex
  const apex = getHostInfo(createMockRequest("orbitwork.org"));
  assert.equal(apex.kind, "apex");
  assert.equal(apex.isProduction, true);
  assert.equal(apex.isLocal, false);

  // WWW
  const www = getHostInfo(createMockRequest("www.orbitwork.org"));
  assert.equal(www.kind, "www");
  assert.equal(www.isProduction, true);

  // App
  const app = getHostInfo(createMockRequest("app.orbitwork.org"));
  assert.equal(app.kind, "app");
  assert.equal(app.isProduction, true);

  // API
  const api = getHostInfo(createMockRequest("api.orbitwork.org"));
  assert.equal(api.kind, "api");
  assert.equal(api.isProduction, true);

  // Docs
  const docs = getHostInfo(createMockRequest("docs.orbitwork.org"));
  assert.equal(docs.kind, "docs");
  assert.equal(docs.isProduction, true);

  // Support
  const support = getHostInfo(createMockRequest("support.orbitwork.org"));
  assert.equal(support.kind, "support");
  assert.equal(support.isProduction, true);

  // Status
  const status = getHostInfo(createMockRequest("status.orbitwork.org"));
  assert.equal(status.kind, "status");
  assert.equal(status.isProduction, true);

  // Blog
  const blog = getHostInfo(createMockRequest("blog.orbitwork.org"));
  assert.equal(blog.kind, "blog");
  assert.equal(blog.isProduction, true);

  // Unknown subdomain
  const unknown = getHostInfo(createMockRequest("random.orbitwork.org"));
  assert.equal(unknown.kind, "unknown");
  assert.equal(unknown.isProduction, true);
});

test("getHostInfo handles local development hostnames with *.localhost and ports", () => {
  const localWww = getHostInfo(createMockRequest("localhost:3000", "http"));
  assert.equal(localWww.kind, "www");
  assert.equal(localWww.isLocal, true);
  assert.equal(localWww.isProduction, false);
  assert.equal(localWww.port, "3000");

  const localApp = getHostInfo(createMockRequest("app.localhost:3005", "http"));
  assert.equal(localApp.kind, "app");
  assert.equal(localApp.isLocal, true);
  assert.equal(localApp.port, "3005");

  const localApi = getHostInfo(createMockRequest("api.localhost:3000", "http"));
  assert.equal(localApi.kind, "api");
  assert.equal(localApi.isLocal, true);

  const localDocs = getHostInfo(createMockRequest("docs.localhost:3000", "http"));
  assert.equal(localDocs.kind, "docs");
  assert.equal(localDocs.isLocal, true);

  const localStatus = getHostInfo(createMockRequest("status.localhost:3000", "http"));
  assert.equal(localStatus.kind, "status");
  assert.equal(localStatus.isLocal, true);
});

test("getSubdomainOrigin returns correct canonical origins", () => {
  assert.equal(getSubdomainOrigin("www"), "https://www.orbitwork.org");
  assert.equal(getSubdomainOrigin("apex"), "https://www.orbitwork.org");
  assert.equal(getSubdomainOrigin("app"), "https://app.orbitwork.org");
  assert.equal(getSubdomainOrigin("api"), "https://api.orbitwork.org");
  assert.equal(getSubdomainOrigin("docs"), "https://docs.orbitwork.org");
  assert.equal(getSubdomainOrigin("support"), "https://support.orbitwork.org");
  assert.equal(getSubdomainOrigin("status"), "https://status.orbitwork.org");
  assert.equal(getSubdomainOrigin("blog"), "https://blog.orbitwork.org");

  // Local development with port preservation
  const mockLocalHost: HostInfo = {
    rawHost: "localhost:3005",
    hostname: "localhost",
    port: "3005",
    protocol: "http",
    subdomain: null,
    kind: "www",
    isLocal: true,
    isPreview: false,
    isProduction: false,
  };
  assert.equal(getSubdomainOrigin("app", mockLocalHost), "http://app.localhost:3005");
  assert.equal(getSubdomainOrigin("docs", mockLocalHost), "http://docs.localhost:3005");
  assert.equal(getSubdomainOrigin("www", mockLocalHost), "http://localhost:3005");
});

test("isAppRoute correctly detects core application endpoints", () => {
  assert.equal(isAppRoute("/dashboard"), true);
  assert.equal(isAppRoute("/dashboard/overview"), true);
  assert.equal(isAppRoute("/login"), true);
  assert.equal(isAppRoute("/signup"), true);
  assert.equal(isAppRoute("/projects/proj_123/tasks"), true);
  assert.equal(isAppRoute("/workspaces"), true);
  assert.equal(isAppRoute("/workspaces/new"), true);
  assert.equal(isAppRoute("/profile"), true);

  // Marketing and portal routes are NOT app routes
  assert.equal(isAppRoute("/"), false);
  assert.equal(isAppRoute("/about"), false);
  assert.equal(isAppRoute("/services"), false);
  assert.equal(isAppRoute("/docs"), false);
  assert.equal(isAppRoute("/support"), false);
  assert.equal(isAppRoute("/status"), false);
  assert.equal(isAppRoute("/blog"), false);
});
