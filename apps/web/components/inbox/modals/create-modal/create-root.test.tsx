import { useImperativeHandle } from "react";
import type { Ref } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { EditorRefApi } from "@plane/editor";
import { setLanguage } from "@plane/i18n";
import { InboxIssueCreateModalRoot } from "./modal";
import { composerCacheKey, readComposerDraft, saveComposerDraft } from "@/components/issues/issue-modal/composer-cache";

vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: { id: "user" } }) }));

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  push: vi.fn(),
  toast: vi.fn(),
  ready: true,
  clear: vi.fn(),
  assets: vi.fn(),
}));
vi.mock("@/hooks/store/use-project-inbox", () => ({ useProjectInbox: () => ({ createInboxIssue: mocks.create }) }));
vi.mock("@/hooks/store/use-workspace", () => ({
  useWorkspace: () => ({ getWorkspaceBySlug: () => ({ id: "workspace-id" }) }),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ getProjectById: () => ({ name: "Project Alpha" }) }),
}));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: mocks.push }) }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@/services/file.service", () => ({
  FileService: class {
    updateBulkProjectAssetsUploadStatus = mocks.assets;
  },
}));
vi.mock("./issue-properties", () => ({ InboxIssueProperties: () => <div>Request properties</div> }));
vi.mock("./issue-description", () => ({
  InboxIssueDescription: ({
    editorRef,
    onAssetUpload,
  }: {
    editorRef: Ref<EditorRefApi>;
    onAssetUpload: (id: string) => void;
  }) => {
    useImperativeHandle(
      editorRef,
      () => ({ isEditorReadyToDiscard: () => mocks.ready, clearEditor: mocks.clear }) as unknown as EditorRefApi
    );
    return (
      <button type="button" onClick={() => onAssetUpload("asset-id")}>
        Attach image
      </button>
    );
  },
}));

beforeEach(() => {
  vi.stubGlobal("PointerEvent", MouseEvent);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  cleanup();
  vi.resetAllMocks();
  mocks.ready = true;
  saveComposerDraft(composerCacheKey("user", "workspace", "intake:project"));
  await setLanguage("en");
});

function fixture() {
  const close = vi.fn();
  render(
    <InboxIssueCreateModalRoot workspaceSlug="workspace" projectId="project" modalState handleModalClose={close} />
  );
  return { close };
}

it("uses request wording, composer layout and blocks blank/oversized titles", async () => {
  await setLanguage("zh-CN");
  fixture();
  expect(screen.getByRole("dialog").hasAttribute("data-issue-composer")).toBe(true);
  expect(screen.getByRole("heading", { name: "提交需求" })).toBeTruthy();
  expect(screen.getByText("Project Alpha")).toBeTruthy();
  const submit = screen.getByRole("button", { name: "提交需求" }) as HTMLButtonElement;
  const title = screen.getByRole("textbox", { name: "需求标题" });
  expect(submit.disabled).toBe(true);
  fireEvent.change(title, { target: { value: "   " } });
  expect(submit.disabled).toBe(true);
  fireEvent.change(title, { target: { value: "x".repeat(256) } });
  expect(submit.disabled).toBe(true);
  expect(title.getAttribute("aria-invalid")).toBe("true");
  fireEvent.submit(title.closest("form")!);
  expect(mocks.create).not.toHaveBeenCalled();
});

it("submits the existing API payload, links uploaded assets and navigates to the request", async () => {
  mocks.create.mockResolvedValue({ issue: { id: "new-request" } });
  const { close } = fixture();
  fireEvent.change(screen.getByRole("textbox", { name: "Request title" }), { target: { value: "A request" } });
  fireEvent.click(screen.getByRole("button", { name: "Attach image" }));
  fireEvent.click(screen.getByRole("button", { name: "Submit request" }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(mocks.create).toHaveBeenCalledExactlyOnceWith("workspace", "project", {
    name: "A request",
    description_html: "<p></p>",
    priority: "none",
    state_id: "",
    label_ids: [],
    assignee_ids: [],
    target_date: null,
  });
  expect(mocks.assets).toHaveBeenCalledWith("workspace", "project", "new-request", { asset_ids: ["asset-id"] });
  expect(mocks.push).toHaveBeenCalledWith(
    "/workspace/projects/project/intake/?currentTab=open&inboxIssueId=new-request"
  );
  expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ message: "Request submitted successfully" }));
});

it("uses the same editor readiness guard for Escape and the close button", async () => {
  mocks.ready = false;
  const { close } = fixture();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(close).not.toHaveBeenCalled();
  mocks.ready = true;
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(close).toHaveBeenCalledOnce();
});

function clickOutside() {
  // Exercise the real Propel/Base UI backdrop and its intentional mouse click sequence.
  const backdrop = document.querySelector<HTMLElement>(".bg-backdrop");
  expect(backdrop).not.toBeNull();
  fireEvent.pointerDown(backdrop!, { button: 0, pointerType: "mouse" });
  fireEvent.mouseDown(backdrop!, { button: 0 });
  fireEvent.pointerUp(backdrop!, { button: 0, pointerType: "mouse" });
  fireEvent.mouseUp(backdrop!, { button: 0 });
  fireEvent.click(backdrop!, { button: 0 });
}

it("saves the request and assets on outside click and restores them when the same dialog reopens", async () => {
  const key = composerCacheKey("user", "workspace", "intake:project");
  const close = vi.fn();
  const props = { workspaceSlug: "workspace", projectId: "project", handleModalClose: close };
  const view = render(<InboxIssueCreateModalRoot {...props} modalState />);
  fireEvent.change(screen.getByRole("textbox", { name: "Request title" }), { target: { value: "Outside draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Attach image" }));
  clickOutside();
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(readComposerDraft(key)).toEqual(
    expect.objectContaining({ values: expect.objectContaining({ name: "Outside draft" }), assetIds: ["asset-id"] })
  );
  view.rerender(<InboxIssueCreateModalRoot {...props} modalState={false} />);
  view.rerender(<InboxIssueCreateModalRoot {...props} modalState />);
  expect((screen.getByRole("textbox", { name: "Request title" }) as HTMLInputElement).value).toBe("Outside draft");
  mocks.create.mockResolvedValue({ issue: { id: "restored" } });
  fireEvent.click(screen.getByRole("button", { name: "Submit request" }));
  await waitFor(() =>
    expect(mocks.assets).toHaveBeenCalledWith("workspace", "project", "restored", { asset_ids: ["asset-id"] })
  );
});

it("retains the popup and draft through the outside-dismissal exit animation", async () => {
  let finishAnimation!: () => void;
  const finished = new Promise<void>((resolve) => {
    finishAnimation = resolve;
  });
  const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "getAnimations");
  Object.defineProperty(HTMLElement.prototype, "getAnimations", {
    configurable: true,
    value: () => [{ finished }],
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  try {
    const close = vi.fn();
    const props = { workspaceSlug: "workspace", projectId: "project", handleModalClose: close };
    const view = render(<InboxIssueCreateModalRoot {...props} modalState />);
    const dialog = screen.getByRole("dialog");
    await waitFor(() => expect(dialog.hasAttribute("data-starting-style")).toBe(false));
    fireEvent.change(screen.getByRole("textbox", { name: "Request title" }), { target: { value: "Animate draft" } });
    clickOutside();
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    view.rerender(<InboxIssueCreateModalRoot {...props} modalState={false} />);
    expect(dialog.isConnected).toBe(true);
    expect(dialog.hasAttribute("data-ending-style")).toBe(true);
    expect((screen.getByRole("textbox", { name: "Request title" }) as HTMLInputElement).value).toBe("Animate draft");
    expect(readComposerDraft(composerCacheKey("user", "workspace", "intake:project"))?.values.name).toBe(
      "Animate draft"
    );
    await act(async () => finishAnimation());
    await waitFor(() => expect(dialog.isConnected).toBe(false));
  } finally {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, "getAnimations", descriptor);
    else delete (HTMLElement.prototype as Partial<HTMLElement>).getAnimations;
  }
});

it("blocks outside dismissal while the editor is processing, preserving the current draft", async () => {
  const key = composerCacheKey("user", "workspace", "intake:project");
  const { close } = fixture();
  fireEvent.change(screen.getByRole("textbox", { name: "Request title" }), { target: { value: "Wait for editor" } });
  mocks.ready = false;
  clickOutside();
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" })));
  expect(close).not.toHaveBeenCalled();
  expect(readComposerDraft(key)).toBeUndefined();
  expect(screen.getByRole("dialog")).toBeTruthy();
  mocks.ready = true;
  clickOutside();
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(readComposerDraft(key)?.values.name).toBe("Wait for editor");
});

it("blocks outside dismissal until submission settles", async () => {
  let resolveSubmission!: (value: { issue: { id: string } }) => void;
  mocks.create.mockReturnValue(
    new Promise((resolve) => {
      resolveSubmission = resolve;
    })
  );
  const { close } = fixture();
  fireEvent.change(screen.getByRole("textbox", { name: "Request title" }), { target: { value: "Submitting" } });
  fireEvent.click(screen.getByRole("button", { name: "Submit request" }));
  clickOutside();
  expect(close).not.toHaveBeenCalled();
  expect(readComposerDraft(composerCacheKey("user", "workspace", "intake:project"))).toBeUndefined();
  expect(screen.getByRole("dialog")).toBeTruthy();
  await act(async () => resolveSubmission({ issue: { id: "submitted" } }));
  expect(close).toHaveBeenCalledOnce();
});

it("retains create-more behavior without navigating or closing", async () => {
  mocks.create.mockResolvedValue({ issue: { id: "new-request" } });
  const { close } = fixture();
  fireEvent.click(screen.getByRole("switch"));
  fireEvent.change(screen.getByRole("textbox", { name: "Request title" }), { target: { value: "Another request" } });
  fireEvent.click(screen.getByRole("button", { name: "Submit request" }));
  await waitFor(() => expect(mocks.clear).toHaveBeenCalledOnce());
  expect(close).not.toHaveBeenCalled();
  expect(mocks.push).not.toHaveBeenCalled();
  expect((screen.getByRole("textbox", { name: "Request title" }) as HTMLInputElement).value).toBe("");
});

it("restores project-isolated cached fields and asset IDs, then clears them after submission", async () => {
  const key = composerCacheKey("user", "workspace", "intake:project");
  saveComposerDraft(key, {
    values: {
      name: "Cached request",
      description_html: "<p>Details</p>",
      priority: "high",
      label_ids: ["label"],
      assignee_ids: ["member"],
      state_id: "state",
      target_date: "2026-11-01",
    },
    assetIds: ["cached-asset"],
  });
  mocks.create.mockResolvedValue({ issue: { id: "restored" } });
  fixture();
  expect((screen.getByRole("textbox", { name: "Request title" }) as HTMLInputElement).value).toBe("Cached request");
  fireEvent.click(screen.getByRole("button", { name: "Submit request" }));
  await waitFor(() => expect(readComposerDraft(key)).toBeUndefined());
  expect(mocks.create).toHaveBeenCalledWith(
    "workspace",
    "project",
    expect.objectContaining({
      priority: "high",
      label_ids: ["label"],
      assignee_ids: ["member"],
      state_id: "state",
      target_date: "2026-11-01",
      description_html: "<p>Details</p>",
    })
  );
  expect(mocks.assets).toHaveBeenCalledWith("workspace", "project", "restored", { asset_ids: ["cached-asset"] });
});

it("saves on close and restores on reopening without leaking into another project", () => {
  const close = vi.fn();
  const view = render(
    <InboxIssueCreateModalRoot workspaceSlug="workspace" projectId="project" modalState handleModalClose={close} />
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Request title" }), { target: { value: "Saved request" } });
  fireEvent.click(screen.getByRole("button", { name: "Attach image" }));
  fireEvent.click(screen.getByRole("button", { name: "Save for later" }));
  expect(readComposerDraft(composerCacheKey("user", "workspace", "intake:project"))).toEqual(
    expect.objectContaining({ values: expect.objectContaining({ name: "Saved request" }), assetIds: ["asset-id"] })
  );
  view.unmount();
  const other = render(
    <InboxIssueCreateModalRoot
      workspaceSlug="workspace"
      projectId="other-project"
      modalState
      handleModalClose={close}
    />
  );
  expect((screen.getByRole("textbox", { name: "Request title" }) as HTMLInputElement).value).toBe("");
  other.unmount();
  fixture();
  expect((screen.getByRole("textbox", { name: "Request title" }) as HTMLInputElement).value).toBe("Saved request");
});

it("does not save an untouched request when closing", () => {
  fixture();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(readComposerDraft(composerCacheKey("user", "workspace", "intake:project"))).toBeUndefined();
});

it("reads the latest saved request when the same dialog instance reopens", () => {
  const close = vi.fn();
  const props = { workspaceSlug: "workspace", projectId: "project", handleModalClose: close };
  const view = render(<InboxIssueCreateModalRoot {...props} modalState />);
  fireEvent.change(screen.getByRole("textbox", { name: "Request title" }), { target: { value: "Reopen me" } });
  fireEvent.click(screen.getByRole("button", { name: "Save for later" }));
  view.rerender(<InboxIssueCreateModalRoot {...props} modalState={false} />);
  view.rerender(<InboxIssueCreateModalRoot {...props} modalState />);
  expect((screen.getByRole("textbox", { name: "Request title" }) as HTMLInputElement).value).toBe("Reopen me");
});

it("keeps a request and its saved assets after a submission error", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.create.mockRejectedValue(new Error("offline"));
  const { close } = fixture();
  fireEvent.change(screen.getByRole("textbox", { name: "Request title" }), { target: { value: "Retry me" } });
  fireEvent.click(screen.getByRole("button", { name: "Attach image" }));
  fireEvent.click(screen.getByRole("button", { name: "Submit request" }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" })));
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Save for later" }));
  expect(readComposerDraft(composerCacheKey("user", "workspace", "intake:project"))).toEqual(
    expect.objectContaining({ assetIds: ["asset-id"], values: expect.objectContaining({ name: "Retry me" }) })
  );
  vi.restoreAllMocks();
});
