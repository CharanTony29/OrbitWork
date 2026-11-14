export async function GET() {
  return Response.json(
    {
      status: "ok",
      service: "Orbitwork API",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: "1.0.0",
      environment: process.env.NODE_ENV || "production",
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Content-Type": "application/json",
      },
    }
  );
}
