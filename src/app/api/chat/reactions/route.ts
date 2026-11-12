import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSchemaMissingError } from "@/lib/chat";
import { hydrateReactionsMap, noStoreJson } from "@/lib/chat-server";

export const dynamic = "force-dynamic";

const reactionSchema = z.object({
  messageId: z.string().uuid(),
  emoji: z.string().trim().min(1).max(16),
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

    const body = await request.json();
    const parsed = reactionSchema.safeParse(body);
    if (!parsed.success) {
      return noStoreJson({ error: "Invalid reaction payload." }, 400);
    }

    const { messageId, emoji } = parsed.data;

    const existingRes = await supabase
      .from("chat_message_reactions")
      .select("id")
      .eq("message_id", messageId)
      .eq("user_id", user.id)
      .eq("emoji", emoji)
      .maybeSingle();

    if (existingRes.error) {
      if (isSchemaMissingError(existingRes.error)) {
        return noStoreJson(
          {
            ok: false,
            migrationMissing: true,
            error:
              "Reactions require running supabase/migrations/202611120001_enterprise_chat.sql first.",
          },
          503
        );
      }
      return noStoreJson({ error: existingRes.error.message }, 500);
    }

    let action: "added" | "removed" = "added";
    if (existingRes.data?.id) {
      action = "removed";
      const { error: delErr } = await supabase
        .from("chat_message_reactions")
        .delete()
        .eq("id", existingRes.data.id)
        .eq("user_id", user.id);
      if (delErr) return noStoreJson({ error: delErr.message }, 500);
    } else {
      const { error: insErr } = await supabase
        .from("chat_message_reactions")
        .insert({
          message_id: messageId,
          user_id: user.id,
          emoji,
        });
      if (insErr) return noStoreJson({ error: insErr.message }, 500);
    }

    const { map } = await hydrateReactionsMap(supabase, [messageId], user.id);

    return noStoreJson({
      ok: true,
      action,
      messageId,
      reactions: map.get(messageId) ?? [],
    });
  } catch (err) {
    console.error("Chat reaction POST error:", err);
    return noStoreJson({ error: "Failed to toggle reaction." }, 500);
  }
}
