import { act, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ReadonlyState } from "./state";

const store = vi.hoisted(() => ({
  getStateById: vi.fn(() => ({ name: "Ready", group: "backlog" })),
  getProjectStateIds: vi.fn((_id: string | undefined): string[] | undefined => undefined),
  fetchProjectStates: vi.fn<(...args: string[]) => Promise<void>>(),
}));
vi.mock("@/hooks/store/use-project-state", () => ({ useProjectState: () => store }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: () => "None" }) }));
vi.mock("@plane/blocks/icons", () => ({ StateGroupIcon: () => null }));
vi.mock("@plane/blocks/skeleton", () => ({
  Loader: Object.assign(({ children }: { children: React.ReactNode }) => <div data-testid="loader">{children}</div>, {
    Item: () => null,
  }),
}));
vi.mock("@plane/utils", () => ({ cn: () => "" }));
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
beforeEach(() => {
  vi.clearAllMocks();
  store.getProjectStateIds.mockReturnValue(undefined);
});
it("keeps the new project's loader when an old request resolves", async () => {
  const first = deferred(),
    second = deferred();
  store.fetchProjectStates.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const { rerender } = render(<ReadonlyState workspaceSlug="w" projectId="a" value="s" />);
  rerender(<ReadonlyState workspaceSlug="w" projectId="b" value="s" />);
  await act(async () => first.resolve());
  expect(screen.queryByTestId("loader")).not.toBeNull();
  await act(async () => second.resolve());
  expect(screen.queryByTestId("loader")).toBeNull();
  expect(screen.getByText("Ready")).toBeTruthy();
});
it("clears loading immediately when switching to cached states", async () => {
  const request = deferred();
  store.fetchProjectStates.mockReturnValueOnce(request.promise);
  const { rerender } = render(<ReadonlyState workspaceSlug="w" projectId="a" value="s" />);
  store.getProjectStateIds.mockReturnValue(["s"]);
  rerender(<ReadonlyState workspaceSlug="w" projectId="cached" value="s" />);
  expect(screen.queryByTestId("loader")).toBeNull();
  await act(async () => request.resolve());
});
it("handles failures and ignores rejected work after unmount", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const first = deferred(),
    second = deferred();
  store.fetchProjectStates.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const { rerender, unmount } = render(<ReadonlyState workspaceSlug="w" projectId="a" value="s" />);
  await act(async () => first.reject(new Error("failed")));
  expect(screen.queryByTestId("loader")).toBeNull();
  expect(error).toHaveBeenCalledTimes(1);
  rerender(<ReadonlyState workspaceSlug="other" projectId="a" value="s" />);
  unmount();
  await act(async () => second.reject(new Error("stale")));
  expect(error).toHaveBeenCalledTimes(1);
  error.mockRestore();
});
