import { afterEach, expect, it, vi } from "vitest";
import { renderMermaidDiagram } from "./mermaid-diagram";

afterEach(() => vi.restoreAllMocks());

it("renders graph TD with the real Mermaid library in strict mode", async () => {
  // jsdom has no SVG layout; Mermaid still uses these browser measurement APIs.
  Object.defineProperty(SVGElement.prototype, "getBBox", {
    configurable: true,
    value: () => ({ x: 0, y: 0, width: 80, height: 20 }),
  });
  Object.defineProperty(SVGElement.prototype, "getComputedTextLength", {
    configurable: true,
    value: () => 80,
  });
  try {
    const uri = await renderMermaidDiagram(
      'graph TD\n A[Start] --> B[Finish]\n click A "https://example.com"',
      "real-mermaid-test"
    );
    const svg = decodeURIComponent(uri.slice(uri.indexOf(",") + 1));
    expect(svg).toContain("<svg");
    expect(svg).toContain("Start");
    expect(svg).toContain("Finish");
    expect(svg).not.toContain('href="https://example.com"');
    expect(document.querySelector("#real-mermaid-test")).toBeNull();
  } finally {
    Reflect.deleteProperty(SVGElement.prototype, "getBBox");
    Reflect.deleteProperty(SVGElement.prototype, "getComputedTextLength");
  }
});
