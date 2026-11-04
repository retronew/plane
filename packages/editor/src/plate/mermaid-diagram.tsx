import { useEffect, useId, useState, type ReactNode } from "react";
import { Button } from "@makeplane/propel/components/button";
import { useTranslation } from "@plane/i18n";
import { NodeApi, type TElement } from "platejs";
// oxlint-disable-next-line import/no-unassigned-import -- Scoped diagram preview styles.
import "./mermaid-diagram.css";

let mermaidLoader: Promise<(typeof import("mermaid"))["default"]> | undefined;

function loadMermaid() {
  mermaidLoader ??= import("mermaid")
    .then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        suppressErrorRendering: true,
        maxTextSize: 50_000,
        htmlLabels: false,
        flowchart: { htmlLabels: false },
        secure: [
          "secure",
          "securityLevel",
          "startOnLoad",
          "maxTextSize",
          "suppressErrorRendering",
          "htmlLabels",
          "flowchart",
        ],
      });
      return mermaid;
    })
    .catch((error: unknown) => {
      mermaidLoader = undefined;
      throw error;
    });
  return mermaidLoader;
}

export async function renderMermaidDiagram(source: string, id: string): Promise<string> {
  const mermaid = await loadMermaid();
  const { svg } = await mermaid.render(id, source);
  // SVG is displayed as an image: links and scripts cannot execute, and Mermaid's
  // bindFunctions callback is deliberately never attached to the editor DOM.
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

type PreviewResult = { source: string; url: string } | { source: string; error: true };

/** Wrap the existing code renderer; the persisted node remains code_block/lang=mermaid. */
export function MermaidDiagram({ element, children }: { element: TElement; children: ReactNode }) {
  const { t } = useTranslation();
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const source = element.children.map((line) => NodeApi.string(line)).join("\n");
  const [mode, setMode] = useState<"source" | "preview">("preview");
  const [result, setResult] = useState<PreviewResult>();
  const current = result?.source === source ? result : undefined;
  useEffect(() => {
    if (mode !== "preview") return;
    let cancelled = false;
    void renderMermaidDiagram(source, `plane-mermaid-${id}`).then(
      (url) => {
        if (!cancelled) setResult({ source, url });
        return undefined;
      },
      (error: unknown) => {
        console.error("Failed to render Mermaid diagram", error);
        if (!cancelled) setResult({ source, error: true });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [id, mode, source]);
  const failed = current && "error" in current;
  return (
    <div className="plane-mermaid-diagram">
      <div className="plane-mermaid-controls" contentEditable={false}>
        <Button
          type="button"
          size="sm"
          stretch="auto"
          variant={mode === "source" ? "tertiary" : "ghost"}
          label={t("web.code")}
          aria-pressed={mode === "source"}
          onClick={() => setMode("source")}
        />
        <Button
          type="button"
          size="sm"
          stretch="auto"
          variant={mode === "preview" ? "tertiary" : "ghost"}
          label={t("preview")}
          aria-pressed={mode === "preview"}
          onClick={() => setMode("preview")}
        />
      </div>
      {mode === "preview" && (
        <div className="plane-mermaid-preview" contentEditable={false}>
          {!current ? (
            <output>{t("loading")}</output>
          ) : "url" in current ? (
            <img src={current.url} alt={t("editor_comparison.diagram")} draggable={false} />
          ) : (
            <p role="alert">{t("something_went_wrong")}</p>
          )}
        </div>
      )}
      <div hidden={mode === "preview" && !failed}>{children}</div>
    </div>
  );
}
