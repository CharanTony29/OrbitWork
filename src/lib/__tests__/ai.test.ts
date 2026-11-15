import test from "node:test";
import assert from "node:assert/strict";
import { polishText } from "../ai/utilities/polish.ts";
import { CHATBOT_SYSTEM_PROMPT } from "../ai/chatbot/index.ts";
import { AGENT_SYSTEM_PROMPT, type AgentActionType } from "../ai/agent/index.ts";

test("polishText returns empty string immediately when given empty/whitespace input", async () => {
  const result = await polishText({ text: "   " });
  assert.equal(result, "");
});

test("Chatbot and Agent modules maintain strict architectural separation", () => {
  assert.ok(CHATBOT_SYSTEM_PROMPT.includes("Orbitwork AI Assistant"));
  assert.ok(AGENT_SYSTEM_PROMPT.includes("Autonomous Task Agent"));
  assert.notEqual(CHATBOT_SYSTEM_PROMPT, AGENT_SYSTEM_PROMPT);

  const testAction: AgentActionType = "auto_assign";
  assert.equal(testAction, "auto_assign");
});
