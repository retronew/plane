import { render } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import { CalendarWeekHeader } from "./week-header";

const profile = vi.hoisted(() => ({ data: { start_of_the_week: 1 } }));
vi.mock("@/hooks/store/user", () => ({ useUserProfile: () => profile }));

const cells = (container: HTMLElement) => [...(container.querySelector(".grid") as HTMLElement).children];

beforeEach(async () => {
  await setLanguage("en");
});

it("keeps one stable header cell per weekday when the language changes", async () => {
  const { container, rerender } = render(<CalendarWeekHeader isLoading={false} showWeekends />);
  const before = cells(container);
  expect(before).toHaveLength(7);
  // `start_of_the_week` is Monday for this profile.
  expect(before[0].textContent).toBe("Mon");

  // The language switch changes the label but must not rebuild the cells: a key derived from the
  // formatted label would remount every header on every render.
  await setLanguage("zh-CN");
  rerender(<CalendarWeekHeader isLoading={false} showWeekends />);
  const after = cells(container);
  expect(after).toHaveLength(7);
  expect(after[0]).toBe(before[0]);
  expect(after[6]).toBe(before[6]);
  expect(after[0].textContent).toBe("周一");
  expect(after[6].textContent).toBe("周日");
});

it("hides the weekend cells and keeps the remaining weekdays mounted", async () => {
  const { container, rerender } = render(<CalendarWeekHeader isLoading={false} showWeekends={false} />);
  expect(cells(container)).toHaveLength(5);
  expect(cells(container).map((cell) => cell.textContent)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);

  rerender(<CalendarWeekHeader isLoading={false} showWeekends />);
  expect(cells(container).map((cell) => cell.textContent)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
});
