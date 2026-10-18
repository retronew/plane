import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DescriptionInput } from "./root";

const editor = vi.hoisted(() => ({ change: undefined as undefined | ((json: object, html: string) => void) }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/utils", () => ({ getDescriptionPlaceholderI18n: () => "placeholder" }));
vi.mock("@/components/editor/rich-text", () => ({
  RichTextEditor: (props: { onChange: typeof editor.change }) => {
    editor.change = props.onChange;
    return null;
  },
}));
vi.mock("@/hooks/store/use-workspace", () => ({
  useWorkspace: () => ({ getWorkspaceBySlug: () => ({ id: "workspace" }) }),
}));
vi.mock("@/hooks/store/use-editor-asset", () => ({ useEditorAsset: () => ({}) }));
vi.mock("@/services/workspace.service", () => ({ WorkspaceService: vi.fn() }));
vi.mock("./loader", () => ({ DescriptionInputLoader: () => null }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
function fixture(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  return {
    entityId: "one",
    workspaceSlug: "workspace",
    initialValue: "<p>initial</p>",
    fileAssetType: "ISSUE_DESCRIPTION" as never,
    onSubmit,
    setIsSubmitting: vi.fn(),
  };
}
it("uses the latest submit callback without saving early or leaving a timer after unmount", async () => {
  vi.useFakeTimers();
  const props = fixture();
  const view = render(<DescriptionInput key="description" {...props} />);
  act(() => editor.change?.({}, "<p>edited</p>"));
  const latest = vi.fn().mockResolvedValue(undefined);
  view.rerender(<DescriptionInput key="description" {...props} onSubmit={latest} />);
  expect(latest).not.toHaveBeenCalled();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1500);
  });
  expect(latest).toHaveBeenCalledExactlyOnceWith({ description_html: "<p>edited</p>", description_json: {} }, false);
  expect(props.onSubmit).not.toHaveBeenCalled();
  view.unmount();
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  expect(latest).toHaveBeenCalledTimes(1);
});
it("flushes the latest callback on unmount and cancels its pending timer", async () => {
  vi.useFakeTimers();
  const props = fixture();
  const latest = vi.fn().mockResolvedValue(undefined);
  const view = render(<DescriptionInput key="description" {...props} />);
  act(() => editor.change?.({}, "<p>pending</p>"));
  view.rerender(<DescriptionInput key="description" {...props} onSubmit={latest} />);
  view.unmount();
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  expect(latest).toHaveBeenCalledExactlyOnceWith({ description_html: "<p>pending</p>", description_json: {} }, false);
  expect(props.onSubmit).not.toHaveBeenCalled();
});
it("flushes the previous entity without saving its content to the next entity", async () => {
  vi.useFakeTimers();
  const props = fixture();
  const latest = vi.fn().mockResolvedValue(undefined);
  const view = render(<DescriptionInput key="description" {...props} />);
  act(() => editor.change?.({}, "<p>old edit</p>"));
  view.rerender(
    <DescriptionInput key="description" {...props} entityId="two" initialValue="<p>next</p>" onSubmit={latest} />
  );
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  expect(props.onSubmit).toHaveBeenCalledExactlyOnceWith(
    { description_html: "<p>old edit</p>", description_json: {} },
    false
  );
  expect(latest).not.toHaveBeenCalled();
});
it("saves a revert to the last saved content while a different edit is in flight", async () => {
  vi.useFakeTimers();
  const props = fixture(vi.fn(() => new Promise<void>(() => {})));
  const view = render(<DescriptionInput key="description" {...props} />);
  act(() => editor.change?.({}, "<p>edited</p>"));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1500);
  });
  act(() => editor.change?.({}, "<p>initial</p>"));
  view.unmount();
  expect(props.onSubmit).toHaveBeenCalledTimes(2);
  expect(props.onSubmit.mock.calls[1]?.[0]).toEqual({ description_html: "<p>initial</p>", description_json: {} });
});
it("does not duplicate the in-flight revision on unmount", async () => {
  vi.useFakeTimers();
  const props = fixture(vi.fn(() => new Promise<void>(() => {})));
  const view = render(<DescriptionInput key="description" {...props} />);
  act(() => editor.change?.({}, "<p>edited</p>"));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1500);
  });
  view.unmount();
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  expect(props.onSubmit).toHaveBeenCalledTimes(1);
});
it("keeps newer edits pending when an earlier save completes", async () => {
  vi.useFakeTimers();
  let finish = () => {};
  const props = fixture(
    vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    )
  );
  const view = render(<DescriptionInput key="description" {...props} />);
  act(() => editor.change?.({}, "<p>first</p>"));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1500);
  });
  act(() => editor.change?.({}, "<p>second</p>"));
  await act(async () => finish());
  view.unmount();
  await act(async () => {});
  expect(props.onSubmit).toHaveBeenCalledTimes(2);
  expect(props.onSubmit.mock.calls[1]?.[0]).toEqual({ description_html: "<p>second</p>", description_json: {} });
});
