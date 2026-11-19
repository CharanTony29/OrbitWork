// src/lib/grammar/harper.ts
// Harper In-Browser & Local WebAssembly Grammar & Spell Engine (Automattic / Harper)

export interface GrammarSuggestion {
  text: string;
  kind?: string;
}

export interface GrammarIssue {
  id: string;
  message: string;
  start: number;
  end: number;
  matchedText: string;
  suggestions: string[];
}

let cachedLinter: any = null;

async function getLinterInstance() {
  if (cachedLinter) return cachedLinter;

  try {
    const [{ LocalLinter }, { binaryInlined }] = await Promise.all([
      import("harper.js"),
      import("harper.js/binaryInlined" as any),
    ]);

    const linter = new LocalLinter({ binary: binaryInlined });
    await linter.setup();
    cachedLinter = linter;
    return cachedLinter;
  } catch (err) {
    console.warn("[Harper Engine] Failed to initialize local Harper binary:", err);
    return null;
  }
}

/**
 * Lints plain text or markdown using Harper's local WebAssembly engine.
 * Detects grammatical errors, typos, misspellings, and stylistic recommendations.
 */
export async function lintTextWithHarper(text: string): Promise<GrammarIssue[]> {
  const clean = text.trim();
  if (!clean || clean.length < 3) return [];

  const linter = await getLinterInstance();
  if (!linter) {
    return [];
  }

  try {
    const rawLints = await linter.lint(text);
    const issues: GrammarIssue[] = [];

    let counter = 0;
    for (const lint of rawLints ?? []) {
      counter++;
      const span = typeof lint.span === "function" ? lint.span() : null;
      if (!span) continue;

      const start = Number(span.start);
      const end = Number(span.end);
      const matchedText = text.slice(start, end);

      const rawSuggestions = typeof lint.suggestions === "function" ? lint.suggestions() : [];
      const suggestions: string[] = [];

      for (const s of rawSuggestions) {
        if (typeof s.get_replacement_text === "function") {
          const rep = s.get_replacement_text();
          if (rep && !suggestions.includes(rep)) {
            suggestions.push(rep);
          }
        }
      }

      const message = typeof lint.message === "function" ? lint.message() : "Grammar or spelling issue";

      issues.push({
        id: `harper-${Date.now()}-${counter}`,
        message,
        start,
        end,
        matchedText,
        suggestions: suggestions.slice(0, 5),
      });
    }

    return issues;
  } catch (lintErr) {
    console.error("[Harper Engine] Error while linting text:", lintErr);
    return [];
  }
}
