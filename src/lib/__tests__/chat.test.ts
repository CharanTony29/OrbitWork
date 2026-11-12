import test from "node:test";
import assert from "node:assert/strict";
import {
  buildChannelThreadKey,
  buildDirectThreadKey,
  buildGroupThreadKey,
  formatSidebarTimestamp,
  getPresenceState,
  isSchemaMissingError,
  resolveEffectivePresence,
  resolveProfileAvatarSrc,
  stripMarkdownForPreview,
} from "../chat.ts";

test("thread key builders produce deterministic keys regardless of argument order", () => {
  const keyA = buildDirectThreadKey("user-b", "user-a");
  const keyB = buildDirectThreadKey("user-a", "user-b");
  assert.equal(keyA, "dm:user-a:user-b");
  assert.equal(keyA, keyB);

  assert.equal(buildChannelThreadKey("general", "org-1"), "ch:org-1:general");
  assert.equal(buildChannelThreadKey("dev-team", null), "ch:global:dev-team");
  assert.equal(buildGroupThreadKey("thread-99"), "grp:thread-99");
});

test("resolveProfileAvatarSrc proxies base64 avatars and preserves HTTP/relative paths", () => {
  assert.equal(resolveProfileAvatarSrc("u1", null), null);
  assert.equal(resolveProfileAvatarSrc("u1", "   "), null);
  assert.equal(
    resolveProfileAvatarSrc("u1", "https://cdn.example.com/avatar.png"),
    "https://cdn.example.com/avatar.png"
  );
  assert.equal(
    resolveProfileAvatarSrc("u1", "/api/profile/avatar?userId=u1"),
    "/api/profile/avatar?userId=u1"
  );
  assert.equal(
    resolveProfileAvatarSrc("u 1", "data:image/png;base64,iVBORw0KGgo="),
    "/api/profile/avatar?userId=u%201&v=34"
  );
});

test("getPresenceState classifies available, away, and offline accurately", () => {
  assert.equal(getPresenceState(null), "offline");
  const now = Date.now();
  assert.equal(getPresenceState(new Date(now - 60_000).toISOString()), "available");
  assert.equal(getPresenceState(new Date(now - 5 * 60_000).toISOString()), "away");
  assert.equal(getPresenceState(new Date(now - 30 * 60_000).toISOString()), "offline");

  assert.equal(
    resolveEffectivePresence(new Date(now - 60_000).toISOString(), "dnd", null),
    "dnd"
  );
  assert.equal(
    resolveEffectivePresence(
      new Date(now - 60_000).toISOString(),
      "busy",
      new Date(now - 10_000).toISOString()
    ),
    "available"
  );
});

test("formatSidebarTimestamp formats today, same-year, and prior-year timestamps", () => {
  assert.equal(formatSidebarTimestamp(null), "");
  assert.equal(formatSidebarTimestamp("invalid-date"), "");

  const now = new Date();
  const sameDay = formatSidebarTimestamp(now.toISOString());
  assert.match(sameDay, /\d{1,2}:\d{2}\s?(AM|PM)/i);

  const priorYear = new Date(now.getFullYear() - 1, 2, 15, 10, 0, 0);
  const priorStr = formatSidebarTimestamp(priorYear.toISOString());
  assert.equal(
    priorStr,
    `3/15/${String(now.getFullYear() - 1).slice(-2)}`
  );
});

test("stripMarkdownForPreview cleans inline images, attachments, and markdown", () => {
  const input = "**Hello** team! ![capture.png](/api/chat/attachments/123) Check `docs`";
  assert.equal(
    stripMarkdownForPreview(input),
    "Hello team! [Image] Check docs"
  );

  const fileInput = "📎 [spec.pdf](/api/chat/attachments/456)";
  assert.equal(stripMarkdownForPreview(fileInput), "📎 spec.pdf");
});

test("isSchemaMissingError identifies missing tables/columns without catching RLS errors", () => {
  assert.equal(isSchemaMissingError(null), false);
  assert.equal(isSchemaMissingError({ code: "42P01", message: "relation missing" }), true);
  assert.equal(isSchemaMissingError({ code: "PGRST205", message: "schema cache" }), true);
  assert.equal(
    isSchemaMissingError({ message: "column thread_id does not exist" }),
    true
  );
  assert.equal(
    isSchemaMissingError({ code: "42501", message: "new row violates row-level security policy" }),
    false
  );
});
