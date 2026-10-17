import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { TransferIssues } from "./transfer-issues";

vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));

it("shows the completed-cycle banner without a transfer action when there are no transferable items", () => {
  const { container } = render(<TransferIssues handleClick={vi.fn()} />);
  expect(container.querySelector('[data-slot="banner-title"]')?.textContent).toBe(
    "web.completed_cycles_are_not_editable"
  );
  expect(screen.queryByRole("button")).toBeNull();
});

it("retains transfer permissions and submission protection", () => {
  const handleClick = vi.fn();
  const { rerender } = render(<TransferIssues handleClick={handleClick} canTransferIssues disabled />);
  fireEvent.click(screen.getByRole("button"));
  expect(handleClick).not.toHaveBeenCalled();
  rerender(<TransferIssues handleClick={handleClick} canTransferIssues />);
  fireEvent.click(screen.getByRole("button"));
  expect(handleClick).toHaveBeenCalledOnce();
});
