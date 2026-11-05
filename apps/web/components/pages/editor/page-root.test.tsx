import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PageRoot } from "./page-root";

const { failure } = vi.hoisted(() => ({ failure: { crash: true } }));
vi.mock("@/hooks/pages", () => ({
  usePagesPaneExtensions: () => ({}),
  useExtendedEditorProps: () => ({}),
}));
vi.mock("../navigation-pane", () => ({ PageNavigationPaneRoot: () => null }));
vi.mock("../version", () => ({ PageVersionsOverlay: () => null }));
vi.mock("../version/editor", () => ({ PagesVersionEditor: () => null }));
vi.mock("./toolbar", () => ({ PageEditorToolbarRoot: () => null }));
vi.mock("./editor-body", () => ({
  PageEditorBody: () => {
    if (failure.crash) throw new Error("Invalid document");
    return <div>Document loaded</div>;
  },
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  failure.crash = true;
});

function propsFor(id = "page-1") {
  return {
    page: { id, isContentEditable: true, editor: { setEditorRef: vi.fn() } },
    handlers: {},
    config: {},
    workspaceSlug: "workspace",
  } as unknown as ComponentProps<typeof PageRoot>;
}

it("keeps the workspace mounted when a document crashes and supports retry", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  render(
    <>
      <nav>Workspace navigation</nav>
      <PageRoot {...propsFor()} />
    </>
  );
  expect(screen.getByRole("navigation").textContent).toBe("Workspace navigation");
  expect(screen.queryByText("Document loaded")).toBeNull();
  const retry = screen.getByRole("button");
  failure.crash = false;
  fireEvent.click(retry);
  expect(screen.getByText("Document loaded")).toBeTruthy();
});

it("clears a failed document state when navigating to another page", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const view = render(<PageRoot {...propsFor()} />);
  expect(screen.getByRole("button")).toBeTruthy();
  failure.crash = false;
  view.rerender(<PageRoot {...propsFor("page-2")} />);
  expect(screen.getByText("Document loaded")).toBeTruthy();
});
