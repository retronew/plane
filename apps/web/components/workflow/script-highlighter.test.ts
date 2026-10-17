import { describe, expect, it } from "vitest";
import { getScriptHighlighter } from "./script-highlighter";
import type { ScriptLanguage } from "./script-highlighter";

describe("script syntax highlighting", () => {
  it.each<[ScriptLanguage, string]>([
    ["javascript", "// draft\nconst message = 'Hello';\nreturn { success: true };\n\n"],
    ["python", '# draft\ndef greet(name):\n\treturn f"Hello {name}"\n\n'],
    ["bash", '#!/bin/bash\n# draft\nif [ -n "$HOME" ]; then\n  echo "Hello"\nfi\n\n'],
    ["json", '{\n  "message": "Hello",\n  "success": true\n}\n\n'],
  ])("tokenizes %s with both theme colors while preserving whitespace", async (lang, source) => {
    const highlighter = await getScriptHighlighter();
    const { tokens } = highlighter.codeToTokens(source, {
      lang,
      themes: { light: "github-light", dark: "github-dark" },
    });
    expect(tokens.map((line) => line.map((token) => token.content).join("")).join("\n")).toBe(source);
    expect(tokens).toHaveLength(source.split("\n").length);
    const styles = tokens.flat().map((token) => token.htmlStyle);
    expect(new Set(styles.map((style) => style?.color)).size).toBeGreaterThan(1);
    expect(styles.every((style) => style?.color && style["--shiki-dark"])).toBe(true);
    expect(styles.some((style) => style?.color !== style?.["--shiki-dark"])).toBe(true);
  });

  it("preserves the editable first line and every blank line", async () => {
    const highlighter = await getScriptHighlighter();
    for (const source of ["", "\n", "\n\n"]) {
      expect(highlighter.codeToTokens(source, { lang: "javascript", theme: "github-light" }).tokens).toHaveLength(
        source.split("\n").length
      );
    }
  });
});
