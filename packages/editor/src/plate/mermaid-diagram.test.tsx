import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NodeApi, type TElement } from "platejs";
import { MermaidDiagram } from "./mermaid-diagram";

const mermaid = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn(), bindFunctions: vi.fn() }));
vi.mock("mermaid", () => ({ default: mermaid }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(() => {
  cleanup();
  mermaid.render.mockReset();
  mermaid.bindFunctions.mockClear();
  vi.restoreAllMocks();
});

function node(source = "graph TD\n  A --> B"): TElement {
  return {
    type: "code_block",
    lang: "mermaid",
    children: source.split("\n").map((text) => ({ type: "code_line", children: [{ text }] })),
  };
}
function mount(element = node()) {
  return render(
    <MermaidDiagram element={element}>
      <pre data-testid="source">{element.children.map((line) => NodeApi.string(line)).join("\n")}</pre>
    </MermaidDiagram>
  );
}

it("initializes strict rendering and displays inert SVG without binding diagram interactions", async () => {
  mermaid.render.mockResolvedValue({
    svg: '<svg xmlns="http://www.w3.org/2000/svg"><a href="https://example.com"><text>A</text></a></svg>',
    bindFunctions: mermaid.bindFunctions,
  });
  const view = mount();
  const image = await screen.findByRole("img", { name: "editor_comparison.diagram" });
  expect(image.getAttribute("src")).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  expect(mermaid.initialize).toHaveBeenCalledWith(
    expect.objectContaining({ securityLevel: "strict", startOnLoad: false, htmlLabels: false })
  );
  expect(mermaid.render).toHaveBeenCalledWith(expect.stringMatching(/^plane-mermaid-/), "graph TD\n  A --> B");
  expect(mermaid.bindFunctions).not.toHaveBeenCalled();
  expect(view.container.querySelector("a")).toBeNull();
  expect(screen.getByTestId("source").parentElement?.hidden).toBe(true);
});

it("switches to editable source without changing the persisted code node", async () => {
  mermaid.render.mockResolvedValue({ svg: "<svg></svg>" });
  const element = node();
  const original = JSON.stringify(element);
  mount(element);
  await screen.findByRole("img");
  fireEvent.click(screen.getByRole("button", { name: "web.code" }));
  expect(screen.getByTestId("source").parentElement?.hidden).toBe(false);
  expect(screen.queryByRole("img")).toBeNull();
  expect(JSON.stringify(element)).toBe(original);
  fireEvent.click(screen.getByRole("button", { name: "preview" }));
  await screen.findByRole("img");
});

it("retains visible source and reports rendering errors", async () => {
  mermaid.render.mockRejectedValue(new Error("Invalid syntax"));
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mount(node("not valid mermaid"));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByTestId("source").parentElement?.hidden).toBe(false);
  expect(screen.getByTestId("source").textContent).toBe("not valid mermaid");
});

it("does not replace the latest preview with a stale async render", async () => {
  let resolveOld!: (value: { svg: string }) => void;
  mermaid.render.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      })
  );
  mermaid.render.mockResolvedValueOnce({ svg: "<svg>new</svg>" });
  const view = mount();
  await waitFor(() => expect(mermaid.render).toHaveBeenCalled());
  view.rerender(
    <MermaidDiagram element={node("graph TD\n C --> D")}>
      <pre>new source</pre>
    </MermaidDiagram>
  );
  const image = await screen.findByRole("img");
  expect(decodeURIComponent(image.getAttribute("src") ?? "")).toContain("<svg>new</svg>");
  await act(async () => {
    resolveOld({ svg: "<svg>old</svg>" });
  });
  expect(decodeURIComponent(image.getAttribute("src") ?? "")).toContain("<svg>new</svg>");
});
