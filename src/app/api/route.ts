export async function GET() {
  return Response.json(
    {
      name: "Orbitwork API",
      status: "online",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      health: "/health",
      documentation: "https://docs.orbitwork.org",
      endpoints: {
        health: "/health",
        search: "/api/search",
        tasks: "/api/tasks",
        projects: "/api/projects",
        workspaces: "/api/workspaces",
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Content-Type": "application/json",
      },
    }
  );
}
