import { NextRequest } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(120),
  organization: z.string().trim().max(160).optional().default(""),
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address (e.g. name@company.com).")
    .max(200),
  topic: z.string().trim().min(1).max(160).default("General Feedback"),
  message: z
    .string()
    .trim()
    .min(2, "Please write a message or feedback before sending.")
    .max(5000),
  website: z.string().optional(), // honeypot
});

// Light per-IP cooldown map to curb automated form abuse without blocking legitimate visitors
const recentSubmissions = new Map<string, number>();

function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = contactSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          ok: false,
          error: parsed.error.issues[0]?.message || "Invalid contact form input.",
        },
        { status: 400 }
      );
    }

    // Silent accept on spam honeypot fill
    if (parsed.data.website && parsed.data.website.trim().length > 0) {
      return Response.json({ ok: true });
    }

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "anonymous";
    const now = Date.now();
    const lastHit = recentSubmissions.get(clientIp) ?? 0;
    if (now - lastHit < 8_000) {
      return Response.json(
        { ok: false, error: "Please wait a few seconds before sending again." },
        { status: 429 }
      );
    }
    recentSubmissions.set(clientIp, now);
    if (recentSubmissions.size > 500) {
      for (const [k, ts] of recentSubmissions.entries()) {
        if (now - ts > 60_000) recentSubmissions.delete(k);
      }
    }

    const { name, organization, email, topic, message } = parsed.data;

    // Best-effort database archival (works for anon + authenticated when migration is applied)
    let savedToDb = false;
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

      const { error: dbErr } = await supabase.from("contact_inquiries").insert({
        name,
        organization,
        email,
        topic,
        message,
        user_id: user?.id ?? null,
      });
      if (!dbErr) savedToDb = true;
    } catch {
      // Non-blocking if contact_inquiries table has not been migrated yet
    }

    const destination =
      process.env.CONTACT_TO_EMAIL?.trim() || "orbitwork.admin@gmail.com";

    const emailRes = await sendEmail({
      to: destination,
      replyTo: email,
      subject: `[Orbitwork Contact] ${topic} — ${name}${organization ? ` (${organization})` : ""}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #17231f; max-width: 600px; margin: 0 auto; border: 1px solid #e3e8e4; border-radius: 10px; overflow: hidden;">
          <div style="background: #167c58; color: #ffffff; padding: 16px 20px;">
            <h2 style="margin: 0; font-size: 18px;">New Orbitwork Contact / Feedback</h2>
          </div>
          <div style="padding: 20px; background: #ffffff; line-height: 1.6; font-size: 14px;">
            <p style="margin: 0 0 8px;"><strong>From:</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p>
            ${organization ? `<p style="margin: 0 0 8px;"><strong>Organization:</strong> ${escapeHtml(organization)}</p>` : ""}
            <p style="margin: 0 0 14px;"><strong>Topic:</strong> ${escapeHtml(topic)}</p>
            <div style="background: #f6f8f6; border: 1px solid #e3e8e4; border-radius: 8px; padding: 14px; white-space: pre-wrap;">${escapeHtml(message)}</div>
          </div>
        </div>
      `,
      text: `From: ${name} <${email}>\nOrganization: ${organization || "-"}\nTopic: ${topic}\n\n${message}`,
    });

    if (!emailRes.ok && !savedToDb) {
      return Response.json(
        {
          ok: false,
          error:
            "We could not deliver your message automatically right now. Please email orbitwork.admin@gmail.com directly.",
        },
        { status: 500 }
      );
    }

    return Response.json(
      {
        ok: true,
        deliveredByEmail: emailRes.ok,
        savedToDb,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Contact POST error:", err);
    return Response.json(
      { ok: false, error: "Unexpected error submitting feedback." },
      { status: 500 }
    );
  }
}
