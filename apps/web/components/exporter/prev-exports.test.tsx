import type { ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PrevExports } from "./prev-exports";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/services/integrations", () => ({
  IntegrationService: class {
    getExportsServicesList = mocks.fetch;
  },
}));
vi.mock("./column", () => ({ useExportColumns: () => [] }));
vi.mock("@/components/common/data-table", () => ({ DataTable: () => <div>exports</div> }));
vi.mock("@/components/ui/loader/settings/import-and-export", () => ({
  ImportExportSettingsLoader: () => <div>loading</div>,
}));
vi.mock("@plane/blocks/empty-state", () => ({ EmptyStateCompact: () => <div>empty</div> }));
vi.mock("@makeplane/propel/components/icon", () => ({ Icon: () => null }));
vi.mock("@makeplane/propel/components/button", () => ({
  Button: ({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  ),
}));
const pending = { results: [{ id: "1", status: "processing" }] };
const complete = { results: [{ id: "1", status: "completed" }] };
function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, revalidateOnFocus: false }}>
      {children}
    </SWRConfig>
  );
}
beforeEach(() => {
  vi.useFakeTimers();
  mocks.fetch.mockReset().mockResolvedValue(pending);
});
afterEach(() => {
  vi.useRealTimers();
});
async function tick(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
it("serializes polling and manual refresh, then stops after completion", async () => {
  let resolve!: (value: typeof complete) => void;
  mocks.fetch.mockResolvedValueOnce(pending).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  render(<PrevExports workspaceSlug="w" cursor="first" per_page={10} setCursor={vi.fn()} />, { wrapper: Wrapper });
  await tick();
  await tick(3000);
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "refresh_status" }));
  await tick(9000);
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  await act(async () => resolve(complete));
  await tick(9000);
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
});
it("does not keep polling the previous page or after unmount", async () => {
  const { rerender, unmount } = render(
    <PrevExports workspaceSlug="w" cursor="first" per_page={10} setCursor={vi.fn()} />,
    { wrapper: Wrapper }
  );
  await tick();
  mocks.fetch.mockResolvedValueOnce(complete);
  rerender(<PrevExports workspaceSlug="w" cursor="second" per_page={20} setCursor={vi.fn()} />);
  await tick();
  await tick(9000);
  expect(mocks.fetch.mock.calls).toEqual([
    ["w", "first", 10],
    ["w", "second", 20],
  ]);
  unmount();
  await tick(9000);
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
});
it("does not refresh a disabled key", async () => {
  render(<PrevExports workspaceSlug="w" cursor={undefined} per_page={10} setCursor={vi.fn()} />, { wrapper: Wrapper });
  fireEvent.click(screen.getByRole("button", { name: "refresh_status" }));
  await tick(9000);
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it("does not restart polling when an in-flight response arrives after unmount", async () => {
  let resolve!: (value: typeof pending) => void;
  mocks.fetch.mockResolvedValueOnce(pending).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  const { unmount } = render(<PrevExports workspaceSlug="w" cursor="first" per_page={10} setCursor={vi.fn()} />, {
    wrapper: Wrapper,
  });
  await tick();
  await tick(3000);
  unmount();
  await act(async () => resolve(pending));
  await tick(9000);
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
});
