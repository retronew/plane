import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { TMentionSection } from "@/types";
import {
  MentionsListDropdown,
  type MentionsListDropdownProps,
} from "../src/extensions/mentions/mentions-list-dropdown";

vi.mock("@floating-ui/react", () => ({ FloatingOverlay: () => null }));
vi.mock("@plane/hooks", () => ({ useOutsideClickDetector: () => {} }));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));
vi.mock("@plane/utils", () => ({ cn: () => "" }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
function sections(title: string): TMentionSection[] {
  return [{ key: title, title, items: [] }] as TMentionSection[];
}
function props(searchCallback: MentionsListDropdownProps["searchCallback"], query = "old"): MentionsListDropdownProps {
  return { searchCallback, query, command: vi.fn(), onClose: vi.fn() } as unknown as MentionsListDropdownProps;
}
it("ignores old results while a newer query is still debouncing", async () => {
  vi.useFakeTimers();
  let resolveOld: (value: TMentionSection[]) => void = () => {};
  const search = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<TMentionSection[]>((resolve) => {
          resolveOld = resolve;
        })
    )
    .mockResolvedValue(sections("new result"));
  const view = render(<MentionsListDropdown {...props(search)} />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  view.rerender(<MentionsListDropdown {...props(search, "new")} />);
  await act(async () => resolveOld(sections("stale result")));
  expect(screen.queryByText("stale result")).toBeNull();
  expect(screen.queryByText("web.loading")).not.toBeNull();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(screen.queryByText("new result")).not.toBeNull();
});
it("ignores a previous callback's in-flight response", async () => {
  vi.useFakeTimers();
  let resolveOld: (value: TMentionSection[]) => void = () => {};
  const old = vi.fn(
    () =>
      new Promise<TMentionSection[]>((resolve) => {
        resolveOld = resolve;
      })
  );
  const latest = vi.fn().mockResolvedValue(sections("latest callback"));
  const view = render(<MentionsListDropdown {...props(old)} />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  view.rerender(<MentionsListDropdown {...props(latest)} />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  await act(async () => resolveOld(sections("old callback")));
  expect(screen.queryByText("latest callback")).not.toBeNull();
  expect(screen.queryByText("old callback")).toBeNull();
});
it("clears prior results when the next search fails", async () => {
  vi.useFakeTimers();
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const search = vi.fn().mockResolvedValueOnce(sections("prior result")).mockRejectedValueOnce(new Error("failed"));
  const view = render(<MentionsListDropdown {...props(search)} />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  view.rerender(<MentionsListDropdown {...props(search, "next")} />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(screen.queryByText("prior result")).toBeNull();
  expect(screen.queryByText("web.no_results")).not.toBeNull();
  error.mockRestore();
});
it("cancels queued searches on callback replacement and unmount", async () => {
  vi.useFakeTimers();
  const old = vi.fn().mockResolvedValue([]);
  const latest = vi.fn().mockResolvedValue([]);
  const view = render(<MentionsListDropdown {...props(old)} />);
  view.rerender(<MentionsListDropdown {...props(latest)} />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(old).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledExactlyOnceWith("old");
  view.rerender(<MentionsListDropdown {...props(latest, "pending")} />);
  view.unmount();
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  expect(latest).toHaveBeenCalledTimes(1);
});
