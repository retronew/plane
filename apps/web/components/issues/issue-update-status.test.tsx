import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { NameDescriptionUpdateStatus } from "./issue-update-status";

vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));

it("hides the initial idle status without relying on legacy editor styles", () => {
  render(<NameDescriptionUpdateStatus isSubmitting="saved" />);
  const status = screen.getByText("web.saved").parentElement;
  expect(status?.getAttribute("aria-hidden")).toBe("true");
  expect(status?.classList.contains("opacity-0")).toBe(true);
});

it("shows saving and completion feedback before fading back to idle", () => {
  const view = render(<NameDescriptionUpdateStatus isSubmitting="submitting" />);
  expect(screen.getByText("web.saving_2").parentElement?.classList.contains("opacity-100")).toBe(true);
  view.rerender(<NameDescriptionUpdateStatus isSubmitting="submitted" />);
  expect(screen.getByText("web.saved").parentElement?.getAttribute("aria-hidden")).toBe("false");
  expect(screen.getByText("web.saved").parentElement?.classList.contains("opacity-100")).toBe(true);
  view.rerender(<NameDescriptionUpdateStatus isSubmitting="saved" />);
  expect(screen.getByText("web.saved").parentElement?.classList.contains("opacity-0")).toBe(true);
});
