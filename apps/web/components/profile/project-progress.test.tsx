import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ProfileProjectProgress } from "./project-progress";
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
it("exposes the category and real count for every non-empty segment", () => {
  render(<ProfileProjectProgress created={3} assigned={2} pending={0} completed={1} />);
  const segments = ["web.created · 3 issues", "web.assigned · 2 issues", "web.completed · 1 issues"].map(
    (label) => screen.getByText(label).parentElement!
  );
  expect(segments.map((segment) => segment.textContent)).toEqual([
    "web.created · 3 issues",
    "web.assigned · 2 issues",
    "web.completed · 1 issues",
  ]);
  expect(segments.map((segment) => segment.style.width)).toEqual(["50%", "33.33333333333333%", "16.666666666666664%"]);
});
it("does not show a progress bar or invalid percentages when there are no work items", () => {
  const { container } = render(<ProfileProjectProgress created={0} assigned={0} pending={0} completed={0} />);
  expect(container.childElementCount).toBe(0);
});
