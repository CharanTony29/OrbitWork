/**
 * Type definitions for the Conversational AI Chatbot.
 * Chatbot focuses on user Q&A, interactive brainstorming, and advisory guidance.
 */

export interface ChatbotMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
}

export interface ChatbotContext {
  userId: string;
  organizationId?: string;
  workspaceId?: string;
  projectId?: string;
  taskId?: string;
}
