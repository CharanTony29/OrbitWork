import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSchemaMissingError } from "@/lib/chat";
import { noStoreJson, touchUserPresence } from "@/lib/chat-server";

export const dynamic = "force-dynamic";

const readSchema = z.object({
  threadKey: z.string().trim().min(1).max(160).optional(),
  heartbeatOnly: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return noStoreJson({ error: "Unauthorized" }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const parsed = readSchema.safeParse(body);
    if (!parsed.success) {
      return noStoreJson({ error: "Invalid read receipt payload." }, 400);
    }

    await touchUserPresence(supabase, user.id);

    const nowIso = new Date().toISOString();
    let enhancedMigrationMissing = false;

    if (parsed.data.threadKey && !parsed.data.heartbeatOnly) {
      const { error } = await supabase.from("chat_read_receipts").upsert(
        {
          user_id: user.id,
          thread_key: parsed.data.threadKey,
          last_read_at: nowIso,
        },
        { onConflict: "user_id,thread_key" }
      );

      if (error) {
        if (isSchemaMissingError(error)) {
          enhancedMigrationMissing = true;
        } else {
          return noStoreJson({ error: error.message }, 500);
        }
      }
    }

    return noStoreJson({
      ok: true,
      lastReadAt: nowIso,
      enhancedMigrationMissing,
    });
  } catch (err) {
    console.error("Chat read POST error:", err);
    return noStoreJson({ error: "Failed to update read status." }, 500);
  }
}
