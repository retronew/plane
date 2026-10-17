import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

export type ScriptLanguage = "javascript" | "python" | "bash" | "json";

// Keep the editor bundle limited to the supported grammars and share one engine.
const createScriptHighlighter = () =>
  createHighlighterCore({
    engine: createJavaScriptRegexEngine(),
    themes: [import("shiki/themes/github-light.mjs"), import("shiki/themes/github-dark.mjs")],
    langs: [
      import("shiki/langs/javascript.mjs"),
      import("shiki/langs/python.mjs"),
      import("shiki/langs/bash.mjs"),
      import("shiki/langs/json.mjs"),
    ],
  });

let highlighter: ReturnType<typeof createScriptHighlighter> | undefined;

export function getScriptHighlighter() {
  highlighter ??= createScriptHighlighter().catch((error: unknown) => {
    highlighter = undefined;
    throw error;
  });
  return highlighter;
}

export type ScriptHighlighter = Awaited<ReturnType<typeof getScriptHighlighter>>;
