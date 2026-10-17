// Lines and tokens are stateless positional text nodes, so positional keys preserve
// their DOM nodes while typing (including repeated tokens and empty lines).
/* oxlint-disable react/no-array-index-key */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, UIEvent } from "react";
import type { ThemedToken } from "shiki/core";
import { getScriptHighlighter } from "./script-highlighter";
import type { ScriptHighlighter, ScriptLanguage } from "./script-highlighter";

type ScriptEditorProps = {
  id?: string;
  "aria-label": string;
  value: string;
  onChange: (value: string) => void;
  language: ScriptLanguage;
  disabled?: boolean;
  compact?: boolean;
};

export function ScriptEditor({
  id,
  "aria-label": ariaLabel,
  value,
  onChange,
  language,
  disabled = false,
  compact = false,
}: ScriptEditorProps) {
  const [highlighter, setHighlighter] = useState<ScriptHighlighter>();
  const codeRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    void getScriptHighlighter().then(
      (instance) => {
        if (active) setHighlighter(instance);
        return undefined;
      },
      (error: unknown) => {
        // The plain-text layer remains editable if grammar loading fails.
        console.error("Failed to load script syntax highlighting", error);
      }
    );
    return () => {
      active = false;
    };
  }, []);

  const lines = useMemo<Pick<ThemedToken, "content" | "htmlStyle">[][]>(() => {
    if (!highlighter) return value.split("\n").map((content) => [{ content }]);
    return highlighter.codeToTokens(value, {
      lang: language,
      themes: { light: "github-light", dark: "github-dark" },
    }).tokens;
  }, [highlighter, value, language]);

  const syncScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = event.currentTarget;
    // Translate the backing layers rather than independently clamping their scroll
    // positions: the textarea's native scrollbars reduce its viewport dimensions.
    if (codeRef.current) codeRef.current.style.transform = `translate(${-scrollLeft}px, ${-scrollTop}px)`;
    if (gutterRef.current) gutterRef.current.style.transform = `translateY(${-scrollTop}px)`;
  };

  return (
    <div
      className={`font-mono tracking-normal relative flex w-full min-w-0 resize-y overflow-hidden rounded-md border border-subtle bg-layer-1 text-[13px] leading-6 focus-within:ring-1 focus-within:ring-accent-strong ${compact ? "h-32 min-h-20" : "h-72 min-h-64"} ${disabled ? "opacity-60" : ""}`}
      style={{
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontVariantLigatures: "none",
        tabSize: 4,
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none shrink-0 overflow-hidden border-r border-subtle bg-layer-2 text-right text-tertiary select-none"
        style={{ width: `calc(${String(lines.length).length}ch + 1.5rem)` }}
      >
        <div ref={gutterRef} className="px-3 py-3">
          {lines.map((_, index) => (
            <div key={index} className="h-6">
              {index + 1}
            </div>
          ))}
        </div>
      </div>
      <div className="relative min-w-0 flex-1">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden select-none">
          <pre ref={codeRef} className="m-0 w-max min-w-full p-3 font-[inherit] text-[13px] leading-6">
            <code className="font-[inherit]">
              {lines.map((tokens, index) => (
                <span key={index} className="block h-6 whitespace-pre">
                  {tokens.map((token, tokenIndex) => {
                    const style = token.htmlStyle
                      ? ({
                          "--script-token-light": token.htmlStyle?.color,
                          "--script-token-dark": token.htmlStyle?.["--shiki-dark"],
                        } as CSSProperties)
                      : undefined;
                    return (
                      <span
                        key={tokenIndex}
                        className={style ? "text-[var(--script-token-light)] dark:text-[var(--script-token-dark)]" : ""}
                        style={style}
                      >
                        {token.content}
                      </span>
                    );
                  })}
                </span>
              ))}
            </code>
          </pre>
        </div>
        <textarea
          id={id}
          aria-label={ariaLabel}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onScroll={syncScroll}
          disabled={disabled}
          wrap="off"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="absolute inset-0 m-0 h-full w-full resize-none overflow-auto border-0 bg-transparent p-3 font-[inherit] text-[13px] leading-6 tracking-[inherit] text-transparent caret-[var(--text-color-primary)] outline-none selection:bg-accent-primary/20"
        />
      </div>
    </div>
  );
}
