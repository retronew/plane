import { createRef } from "react";
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PageEditorBody } from "./editor-body";

vi.mock("@plane/editor/plate", () => ({
  PlateEditorWithRef: ({ placeholder }: { placeholder: string }) => <div data-testid="document">{placeholder}</div>,
}));
vi.mock("./use-page-collaboration", () => ({
  usePageCollaboration: () => ({
    snapshot: { name: "Title", can_edit: true, description_html: "<p></p>", epoch: 1 },
    collaboration: {},
    generation: 1,
    saveError: true,
  }),
}));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: { id: "user" } }) }));
vi.mock("@/hooks/store/use-workspace", () => ({
  useWorkspace: () => ({ getWorkspaceBySlug: () => ({ id: "workspace" }) }),
}));
vi.mock("@/hooks/store/use-member", () => ({ useMember: () => ({ getUserDetails: vi.fn() }) }));
vi.mock("@/hooks/editor", () => ({ useEditorMention: () => ({ fetchMentions: vi.fn() }) }));
vi.mock("@/hooks/use-editor-flagging", () => ({
  useEditorFlagging: () => ({ document: { disabled: [], flagged: [] } }),
}));
vi.mock("@/hooks/use-parse-editor-content", () => ({ useParseEditorContent: () => ({ getEditorMetaData: vi.fn() }) }));
vi.mock("@/hooks/use-page-filters", () => ({
  usePageFilters: () => ({ fontSize: "small-font", fontStyle: "sans-serif", isFullWidth: false }),
}));
vi.mock("@/hooks/use-realtime-page-events", () => ({
  useRealtimePageEvents: () => ({ updatePageProperties: vi.fn() }),
}));
vi.mock("@/components/editor/embeds/mentions", () => ({ EditorMentionsRoot: () => null }));
vi.mock("./header", () => ({ PageEditorHeaderRoot: () => null }));
vi.mock("./summary", () => ({ PageContentBrowser: () => null }));
vi.mock("./ai/menu", () => ({ EditorAIMenu: () => null }));
vi.mock("./collaborative-title", () => ({ CollaborativePageTitle: () => null, updateCollaborativeTitle: vi.fn() }));

it("renders the ready document with its translated placeholder and original constrained layout", () => {
  const props = {
    config: { fileHandler: {} },
    editorForwardRef: createRef(),
    handlers: { fetchEntity: vi.fn() },
    page: { id: "page", isContentEditable: true, editor: {}, setSyncingStatus: vi.fn() },
    workspaceSlug: "workspace",
    isNavigationPaneOpen: true,
    extendedEditorProps: {},
  } as unknown as ComponentProps<typeof PageEditorBody>;
  render(<PageEditorBody {...props} />);
  const document = screen.getByTestId("document");
  expect(document.textContent).toBeTruthy();
  expect(document.textContent).not.toBe("web.runtime.editor_commands");
  expect(document.parentElement?.className).toContain("max-w-[720px]");
  expect(document.parentElement?.parentElement?.className).toContain("page-header-container");
  expect(document.parentElement?.parentElement?.className).toContain("min-h-screen");
  const alert = screen.getByRole("alert");
  expect(document.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(alert.closest(".sticky")?.className).toContain("bottom-4");
});
