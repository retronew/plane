import React, { Suspense } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CreateUpdateIssueModal } from "./modal";

vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({ useParams: () => ({}) }));
vi.mock("./provider", () => ({
  IssueModalProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
const pending = new Promise<void>(() => {});
vi.mock("./base", () => ({
  CreateUpdateIssueModalBase: ({ modalTitle, isOpen }: { modalTitle?: string; isOpen: boolean }) => {
    if (modalTitle === "suspended") throw pending;
    return (
      <div data-testid="modal" data-open={isOpen}>
        {modalTitle}
      </div>
    );
  },
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("retains the latest committed content during exit and opens with fresh content", () => {
  vi.useFakeTimers();
  const onClose = vi.fn();
  const { rerender } = render(<CreateUpdateIssueModal isOpen onClose={onClose} modalTitle="first" />);
  rerender(<CreateUpdateIssueModal isOpen onClose={onClose} modalTitle="latest" />);
  rerender(<CreateUpdateIssueModal isOpen={false} onClose={onClose} />);
  expect(screen.getByTestId("modal").textContent).toBe("latest");
  expect(screen.getByTestId("modal").getAttribute("data-open")).toBe("false");
  act(() => vi.advanceTimersByTime(450));
  expect(screen.queryByTestId("modal")).toBeNull();
  rerender(<CreateUpdateIssueModal isOpen onClose={onClose} modalTitle="reopened" />);
  expect(screen.getByTestId("modal").textContent).toBe("reopened");
});

it("does not retain props from a suspended render when closing", () => {
  vi.useFakeTimers();
  const onClose = vi.fn();
  const view = (isOpen: boolean, modalTitle?: string) => (
    <Suspense fallback={<div>loading</div>}>
      <CreateUpdateIssueModal isOpen={isOpen} onClose={onClose} modalTitle={modalTitle} />
    </Suspense>
  );
  const { rerender } = render(view(true, "committed"));
  rerender(view(true, "suspended"));
  expect(screen.getByText("loading")).toBeTruthy();
  rerender(view(false));
  expect(screen.queryByText("loading")).toBeNull();
  expect(screen.getByTestId("modal").textContent).toBe("committed");
});
