import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PlateCollaborationConfig } from "@plane/editor/plate";
import { CollaborativeDescriptionInput } from "./collaborative";
const state = vi.hoisted(() => ({
  loading: false,
  data: { can_read: true, can_edit: true, epoch: 1, description_html: "<p>remote</p>" },
  config: undefined as PlateCollaborationConfig | undefined,
  editable: false,
  placeholder: undefined as unknown,
  mutate: vi.fn(),
  retrieve: vi.fn(),
  copy: vi.fn(),
  fetchIssue: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("swr", () => ({ default: () => ({ data: state.loading ? undefined : state.data, mutate: state.mutate }) }));
vi.mock("@makeplane/propel/components/button", () => ({
  Button: ({ label, ...buttonProps }: { label: string }) => <button {...buttonProps}>{label}</button>,
}));
vi.mock("@plane/constants", () => ({ LIVE_URL: "http://localhost:3002" }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/utils", () => ({
  getDescriptionPlaceholderI18n: () => "placeholder",
  getFileURL: (value: string) => value,
  isEmptyHtmlString: (value: string) => !value.replace(/<[^>]*>/g, "").trim(),
}));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: { id: "user", display_name: "User" } }) }));
vi.mock("@/hooks/store/use-workspace", () => ({
  useWorkspace: () => ({ getWorkspaceBySlug: () => ({ id: "workspace" }) }),
}));
vi.mock("@/hooks/store/use-editor-asset", () => ({ useEditorAsset: () => ({}) }));
vi.mock("@/hooks/store/use-issue-detail", () => ({ useIssueDetail: () => ({ fetchIssue: state.fetchIssue }) }));

it("refreshes store after saved and coalesces overlapping acknowledgements without HTML writes", async () => {
  let finish!: () => void;
  state.fetchIssue.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  const initial = props();
  render(<CollaborativeDescriptionInput {...initial} />);
  act(() => {
    state.config?.onStateless?.('{"type":"saved"}');
    state.config?.onStateless?.('{"type":"saved"}');
  });
  expect(state.fetchIssue).toHaveBeenCalledExactlyOnceWith("workspace", "project", "issue");
  await act(async () => {
    finish();
  });
  expect(state.fetchIssue).toHaveBeenCalledTimes(2);
  expect(initial.onSubmit).not.toHaveBeenCalled();
  expect(state.mutate).not.toHaveBeenCalled();
});
vi.mock("@/services/issue/issue-collaboration.service", () => ({
  IssueCollaborationService: class {
    retrieve = state.retrieve;
  },
}));
vi.mock("@/services/workspace.service", () => ({ WorkspaceService: vi.fn() }));
vi.mock("@/components/pages/header/collaboration-users", () => ({ CollaborationUsers: () => null }));
vi.mock("./loader", () => ({ DescriptionInputLoader: () => <div data-testid="description-loading" /> }));
vi.mock("@/components/editor/rich-text", () => ({
  RichTextEditor: (editorProps: {
    collaboration?: PlateCollaborationConfig;
    editable: boolean;
    initialValue: string;
    placeholder: unknown;
  }) => {
    state.placeholder = editorProps.placeholder;
    if (editorProps.collaboration) {
      state.config = editorProps.collaboration;
      state.editable = editorProps.editable;
    }
    return <div data-testid={editorProps.collaboration ? "editor" : "snapshot"}>{editorProps.initialValue}</div>;
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  state.loading = false;
  state.data = { can_read: true, can_edit: true, epoch: 1, description_html: "<p>remote</p>" };
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: state.copy } });
  state.copy.mockResolvedValue(undefined);
  state.retrieve.mockResolvedValue(state.data);
  state.mutate.mockResolvedValue(undefined);
});
afterEach(cleanup);
function props() {
  return {
    key: "description",
    projectId: "project",
    workspaceSlug: "workspace",
    entityId: "issue",
    initialValue: "",
    fileAssetType: "ISSUE_DESCRIPTION" as never,
    onSubmit: vi.fn(),
    setIsSubmitting: vi.fn(),
    editorRef: { current: { getDocument: () => ({ html: "<p>local edit</p>" }) } as never },
  };
}
it("uses one placeholder for empty collaborative descriptions and honors overrides", () => {
  state.data = { ...state.data, description_html: "<p></p>" };
  const initial = props();
  const view = render(<CollaborativeDescriptionInput {...initial} />);
  expect(state.placeholder).toBe("common.press_for_commands");
  view.rerender(<CollaborativeDescriptionInput {...initial} placeholder="Custom description" />);
  expect(state.placeholder).toBe("Custom description");
});

it("keeps configuration stable across callback and response object replacements", () => {
  const initial = props();
  const view = render(<CollaborativeDescriptionInput {...initial} />);
  const config = state.config;
  state.data = { ...state.data };
  const next = vi.fn();
  view.rerender(<CollaborativeDescriptionInput {...initial} setIsSubmitting={next} />);
  expect(state.config).toBe(config);
  act(() => state.config?.onStateless?.('{"type":"pending"}'));
  expect(next).toHaveBeenCalledWith("submitting");
  expect(initial.setIsSubmitting).not.toHaveBeenCalled();
  for (const payload of ["null", "[]", "42", "invalid", '{"type":{}}'])
    expect(() => act(() => state.config?.onStateless?.(payload))).not.toThrow();
});
it("does not announce an initial saved acknowledgement but shows feedback after a pending save", () => {
  const initial = props();
  render(<CollaborativeDescriptionInput {...initial} />);
  act(() => state.config?.onStateless?.('{"type":"saved"}'));
  expect(initial.setIsSubmitting).not.toHaveBeenCalled();
  expect(state.fetchIssue).toHaveBeenCalledWith("workspace", "project", "issue");

  act(() => state.config?.onStateless?.('{"type":"pending"}'));
  expect(initial.setIsSubmitting).toHaveBeenLastCalledWith("submitting");
  act(() => state.config?.onStateless?.('{"type":"saved"}'));
  expect(initial.setIsSubmitting).toHaveBeenLastCalledWith("submitted");
  expect(initial.setIsSubmitting).toHaveBeenCalledTimes(2);
  act(() => state.config?.onStateless?.('{"type":"saved"}'));
  expect(initial.setIsSubmitting).toHaveBeenCalledTimes(2);
});

it("does not fetch or replace a fenced document if clipboard copying fails", async () => {
  const view = render(<CollaborativeDescriptionInput {...props()} />);
  act(() => state.config?.onStateless?.('{"type":"fenced"}'));
  state.copy.mockRejectedValue(new Error("denied"));
  await act(async () => fireEvent.click(view.getByText("editor_collaboration.copy_reconnect")));
  expect(state.copy).toHaveBeenCalledWith("<p>local edit</p>");
  expect(state.retrieve).not.toHaveBeenCalled();
  expect(state.mutate).not.toHaveBeenCalled();
  expect(state.editable).toBe(false);
  expect(view.getByTestId("editor")).toBeTruthy();
  expect(view.getByText("editor_collaboration.copy_error")).toBeTruthy();
});
it("preserves a local copy for transport errors and contains fetch failures", async () => {
  const view = render(<CollaborativeDescriptionInput {...props()} />);
  act(() => state.config?.onStatusChange?.("error"));
  state.retrieve.mockRejectedValue(new Error("offline"));
  await act(async () => fireEvent.click(view.getByText("editor_collaboration.copy_reconnect")));
  expect(state.copy).toHaveBeenCalledWith("<p>local edit</p>");
  expect(state.mutate).not.toHaveBeenCalled();
  expect(view.getByTestId("editor")).toBeTruthy();
});
it("keeps one loading surface until sync and never returns to a placeholder on disconnect", async () => {
  state.loading = true;
  const initial = { ...props(), initialValue: "<p>saved description</p>" };
  const view = render(<CollaborativeDescriptionInput {...initial} />);
  expect(view.getByTestId("description-loading")).toBeTruthy();
  expect(view.queryByTestId("editor")).toBeNull();
  state.loading = false;
  view.rerender(<CollaborativeDescriptionInput {...initial} />);
  expect(view.container.querySelector("[data-description-editor]")?.getAttribute("aria-hidden")).toBe("true");
  act(() => state.config?.onStatusChange?.("synced"));
  await waitFor(() => expect(view.queryByTestId("description-loading")).toBeNull());
  expect(view.container.querySelector("[data-description-editor]")?.getAttribute("aria-hidden")).toBe("false");
  act(() => state.config?.onStatusChange?.("disconnected"));
  expect(view.queryByTestId("description-loading")).toBeNull();
  expect(view.getByTestId("editor")).toBeTruthy();
});
it("keeps read-only permission after successful reconnect", async () => {
  state.data.can_edit = false;
  const view = render(<CollaborativeDescriptionInput {...props()} />);
  act(() => state.config?.onStateless?.('{"type":"fenced"}'));
  await act(async () => fireEvent.click(view.getByText("editor_collaboration.copy_reconnect")));
  expect(state.mutate).toHaveBeenCalledWith(state.data, { revalidate: false });
  expect(state.editable).toBe(false);
});
