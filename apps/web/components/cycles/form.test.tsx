import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import type { ICycle } from "@plane/types";
import { formatLocalizedDate } from "@plane/utils";
import { CycleForm } from "./form";

vi.mock("@/hooks/store/user", () => ({ useUserProfile: () => ({ data: { start_of_the_week: 1 } }) }));
vi.mock("@/hooks/store/user/user-user", () => ({
  useUser: () => ({ projectsWithCreatePermissions: { project: true } }),
}));
vi.mock("@/components/dropdowns/project/project-select", () => ({ ProjectSelect: () => null }));

const props = {
  handleFormSubmit: vi.fn().mockResolvedValue(undefined),
  handleClose: vi.fn(),
  status: true,
  projectId: "project",
  setActiveProject: vi.fn(),
};
const data = {
  name: "Sprint",
  start_date: "2099-06-10",
  end_date: "2100-07-24",
} as ICycle;

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.getAnimations ??= () => [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});
afterEach(() => vi.unstubAllGlobals());

it.each(["en", "zh-CN"] as const)("keeps both full dates visible in the %s update form", async (locale) => {
  await setLanguage(locale);
  render(<CycleForm {...props} data={data} />);
  const label = `${formatLocalizedDate(new Date(2099, 5, 10), "MMM dd, yyyy")} - ${formatLocalizedDate(new Date(2100, 6, 24), "MMM dd, yyyy")}`;
  const trigger = screen.getByRole("button", { name: label });

  // Remove the shared pill's 160px cap, but stay within the modal and grow vertically on narrow screens.
  expect(trigger.classList.contains("max-w-40")).toBe(false);
  expect(trigger.classList.contains("max-w-full")).toBe(true);
  expect(trigger.classList.contains("h-auto")).toBe(true);
  expect(trigger.classList.contains("min-h-6")).toBe(true);
  expect(trigger.classList.contains("[&>span]:whitespace-normal")).toBe(true);
  expect(trigger.textContent).toBe(label);
});

it("keeps the standard range picker wired to the form and submits both selected dates", async () => {
  await setLanguage("en");
  render(<CycleForm {...props} data={{ ...data, end_date: "2099-06-24" }} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "New sprint" } });
  fireEvent.click(screen.getByRole("button", { name: "Jun 10, 2099 - Jun 24, 2099" }));
  fireEvent.click(screen.getByRole("button", { name: /June 12th, 2099/ }));
  fireEvent.click(screen.getByRole("button", { name: /June 15th, 2099/ }));
  fireEvent.click(screen.getByRole("button", { name: "Update cycle" }));
  await waitFor(() => expect(props.handleFormSubmit).toHaveBeenCalledOnce());
  expect(props.handleFormSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "New sprint",
      start_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      end_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    })
  );
});
