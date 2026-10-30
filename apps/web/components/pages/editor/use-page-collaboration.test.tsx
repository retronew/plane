import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { EditorRefApi } from "@plane/editor";
import type { TPageInstance } from "@/store/pages/base-page";
import { usePageCollaboration } from "./use-page-collaboration";

const mocks = vi.hoisted(() => ({ retrieve: vi.fn(), mutate: vi.fn(), swr: vi.fn(), copy: vi.fn() }));
vi.mock("swr", () => ({
  default: (...args: unknown[]) => {
    mocks.swr(...args);
    return { data: { epoch: 1 }, mutate: mocks.mutate };
  },
}));
vi.mock("@/services/page/page-collaboration.service", () => ({
  PageCollaborationService: class {
    retrieve = mocks.retrieve;
  },
}));
const page = { id: "page", name: "Title", setSyncingStatus: vi.fn() } as TPageInstance;
function mount(editor: Pick<EditorRefApi, "getDocument"> | null) {
  // The hook only consumes getDocument; the remaining editor surface is irrelevant here.
  const editorForwardRef = { current: editor } as React.RefObject<EditorRefApi | null>;
  return renderHook(() =>
    usePageCollaboration({
      page,
      projectId: "project",
      workspaceSlug: "workspace",
      editorForwardRef,
      userConfig: { id: "user", name: "User", avatar: null, color: "blue" },
      updatePageProperties: vi.fn(),
    })
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: mocks.copy } });
  mocks.copy.mockResolvedValue(undefined);
  mocks.retrieve.mockResolvedValue({ epoch: 2 });
  mocks.mutate.mockResolvedValue(undefined);
});
it("copies before a single explicit fetch and disables network revalidation", async () => {
  const { result } = mount({ getDocument: () => ({ html: "<p>Draft</p>", json: null, binary: null }) });
  await act(() => result.current.reconnect());
  expect(mocks.copy).toHaveBeenCalledWith("Title\n<p>Draft</p>");
  expect(mocks.retrieve).toHaveBeenCalledTimes(1);
  expect(mocks.mutate).toHaveBeenCalledWith({ epoch: 2 }, { revalidate: false });
  expect(result.current.generation).toBe(1);
  expect(mocks.swr.mock.calls[0][2]).toMatchObject({ revalidateOnReconnect: false });
});
it("retains the document when the ref is absent or clipboard fails", async () => {
  const missing = mount(null);
  await act(() => missing.result.current.reconnect());
  expect(mocks.retrieve).not.toHaveBeenCalled();
  expect(missing.result.current.copyError).toBe(true);
  missing.unmount();
  mocks.copy.mockRejectedValueOnce(new Error("Clipboard denied"));
  const draft = mount({ getDocument: () => ({ html: "", json: null, binary: null }) });
  await act(() => draft.result.current.reconnect());
  expect(mocks.retrieve).not.toHaveBeenCalled();
  expect(draft.result.current.generation).toBe(0);
});
it("locks duplicate reconnects and stops after unmount during copying", async () => {
  let finish: () => void = () => {};
  mocks.copy.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  const { result, unmount } = mount({ getDocument: () => ({ html: "draft", json: null, binary: null }) });
  let pending: Promise<void>;
  act(() => {
    pending = result.current.reconnect();
  });
  expect(result.current.reconnecting).toBe(true);
  await act(() => result.current.reconnect());
  expect(mocks.copy).toHaveBeenCalledTimes(1);
  unmount();
  finish();
  await pending!;
  expect(mocks.retrieve).not.toHaveBeenCalled();
});
