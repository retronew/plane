import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AsyncContent } from "./async-content";
afterEach(() => vi.useRealTimers());
it("reserves space without flashing a skeleton for a fast request", () => {
  vi.useFakeTimers();
  const { rerender, container } = render(
    <AsyncContent loading skeleton={<p>Skeleton</p>} minHeight={260}>
      <p>Data</p>
    </AsyncContent>
  );
  expect(screen.queryByText("Skeleton")).toBeNull();
  expect(container.firstElementChild?.getAttribute("style")).toContain("260px");
  act(() => vi.advanceTimersByTime(100));
  rerender(
    <AsyncContent loading={false} skeleton={<p>Skeleton</p>}>
      <p>Data</p>
    </AsyncContent>
  );
  act(() => vi.advanceTimersByTime(200));
  expect(screen.queryByText("Skeleton")).toBeNull();
  expect(screen.getByText("Data")).toBeTruthy();
  expect(container.firstElementChild?.getAttribute("aria-busy")).toBe("false");
});
it("shows a matching skeleton after 180ms, then enters data and resets the delay for the next request", () => {
  vi.useFakeTimers();
  const view = (loading: boolean) => (
    <AsyncContent loading={loading} skeleton={<p>Skeleton</p>}>
      <p>Data</p>
    </AsyncContent>
  );
  const { rerender, container } = render(view(true));
  act(() => vi.advanceTimersByTime(179));
  expect(screen.queryByText("Skeleton")).toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByText("Skeleton")).toBeTruthy();
  expect(screen.queryByText("Data")).toBeNull();
  rerender(view(false));
  expect(screen.getByText("Data")).toBeTruthy();
  expect(container.querySelector("[data-loading-skeleton]")).toBeNull();
  rerender(view(true));
  expect(screen.queryByText("Skeleton")).toBeNull();
  act(() => vi.advanceTimersByTime(180));
  expect(screen.getByText("Skeleton")).toBeTruthy();
});
