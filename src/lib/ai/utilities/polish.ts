import { generateTextWithFallback } from "../client.ts";

export type PolishMode =
  | "grammar"
  | "professional"
  | "concise"
  | "bullet_points"
  | "expand";

export interface PolishOptions {
  text: string;
  mode?: PolishMode;
  contextTitle?: string;
  target?: "task" | "document" | "comment" | "general";
}

const MODE_INSTRUCTIONS: Record<PolishMode, string> = {
  grammar:
    "Fix all spelling, punctuation, and grammatical errors. Preserve the original voice, sentence structure, and markdown formatting as much as possible.",
  professional:
    "Rewrite with a clear, professional, and constructive workplace tone suitable for engineering, project management, and cross-functional teams.",
  concise:
    "Make the content direct and concise. Cut filler words and redundancies while preserving all crucial facts, requirements, and constraints.",
  bullet_points:
    "Convert the core ideas, scope, and steps into clear, well-structured markdown bullet points or action items.",
  expand:
    "Expand and clarify the description. Provide clear sections such as Overview, Acceptance Criteria, or Implementation Notes based on the context provided.",
};

export async function polishText({
  text,
  mode = "grammar",
  contextTitle,
  target = "task",
}: PolishOptions): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  const instruction = MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.grammar;

  const prompt = [
    `You are an expert technical editor in a modern project management platform.`,
    `Goal: ${instruction}`,
    contextTitle ? `Context Title: "${contextTitle}"` : "",
    `Entity Type: ${target}`,
    ``,
    `Original Content:`,
    `"""`,
    trimmed,
    `"""`,
    ``,
    `Rules:`,
    `- Output ONLY the final polished replacement text directly.`,
    `- Do NOT include multiple options, headings, meta commentary, greetings, quotes around the output, or explanations.`,
    `- Retain valid markdown (bold, lists, code blocks, images) unless the mode is 'bullet_points', where formatting into a clean list is encouraged.`,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await generateTextWithFallback({
    prompt,
    temperature: mode === "grammar" ? 0.2 : 0.4,
  });

  return response.text.trim();
}
