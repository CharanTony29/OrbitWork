export * from "./types.ts";

/**
 * AI Agent Module
 * Responsible for autonomous background actions, event-driven workflows, and database mutations.
 * Distinct from the interactive Chatbot.
 */
export const AGENT_SYSTEM_PROMPT = `You are the Orbitwork Autonomous Task Agent.
Your responsibility is to analyze task parameters, dependencies, workloads, and user criteria to execute automated actions (such as generating subtasks, assigning parent tasks, and organizing workflows).
Always return strict structured outputs when requested.`;
