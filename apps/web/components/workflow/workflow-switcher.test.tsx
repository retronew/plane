import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { TProjectWorkflow } from "@plane/types";
import { WorkflowSwitcher } from "./workflow-switcher";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));

const base = "/workspace/settings/projects/project/workflows/";
const defaultWorkflow: TProjectWorkflow = {
  id: "default",
  enabled: true,
  is_active: true,
  can_manage: true,
  initial_state_id: null,
  effective_initial_state_id: null,
  states: [],
  transitions: [],
};
const persistedWorkflow: TProjectWorkflow = {
  ...defaultWorkflow,
  id: "legacy-id",
  workflow_id: "persisted-id",
  name: "Bug triage",
};

beforeEach(() => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});
Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });

it("opens a single synthetic default workflow and marks its direct navigation link as current", async () => {
  render(<WorkflowSwitcher workflows={[defaultWorkflow]} currentId="default" base={base} />);
  const trigger = screen.getByRole("button", { name: "web.workflow_ui.default_name" });
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(trigger);
  const row = await screen.findByRole("menuitem", { name: "web.workflow_ui.default_name" });
  expect(row.tagName).toBe("A");
  expect(row.getAttribute("href")).toBe(`${base}default`);
  expect(row.getAttribute("aria-current")).toBe("page");
});

it("keeps the navigation chevron pointing down when hovered and opened", async () => {
  render(<WorkflowSwitcher workflows={[defaultWorkflow]} currentId="default" base={base} />);
  const trigger = screen.getByRole("button", { name: "web.workflow_ui.default_name" });
  const chevron = trigger.lastElementChild;
  const expectStaticChevron = () => {
    expect(chevron?.tagName.toLowerCase()).toBe("svg");
    expect(chevron?.getAttribute("class")).toContain("size-3.5");
    expect(chevron?.getAttribute("class")).not.toMatch(/rotate|transition-transform/);
  };
  expectStaticChevron();
  fireEvent.mouseEnter(trigger);
  expectStaticChevron();
  fireEvent.click(trigger);
  await screen.findByRole("menuitem", { name: "web.workflow_ui.default_name" });
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expectStaticChevron();
});

it.each(["persisted-id", "legacy-id"])("recognizes persisted workflows using currentId=%s", async (currentId) => {
  render(<WorkflowSwitcher workflows={[defaultWorkflow, persistedWorkflow]} currentId={currentId} base={base} />);
  fireEvent.click(screen.getByRole("button", { name: "Bug triage" }));
  const current = await screen.findByRole("menuitem", { name: "Bug triage" });
  expect(current.getAttribute("href")).toBe(`${base}persisted-id`);
  expect(current.getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("menuitem", { name: "web.workflow_ui.default_name" }).hasAttribute("aria-current")).toBe(
    false
  );
});

it("searches names without regard to case or surrounding spaces, shows empty results, and resets on close", async () => {
  render(<WorkflowSwitcher workflows={[defaultWorkflow, persistedWorkflow]} currentId="default" base={base} />);
  const trigger = screen.getByRole("button", { name: "web.workflow_ui.default_name" });
  fireEvent.click(trigger);
  const search = await screen.findByRole("textbox", { name: "web.workflow_ui.search" });
  fireEvent.change(search, { target: { value: " BUG " } });
  expect(screen.getByRole("menuitem", { name: "Bug triage" })).toBeTruthy();
  expect(screen.queryByRole("menuitem", { name: "web.workflow_ui.default_name" })).toBeNull();
  fireEvent.change(search, { target: { value: "missing" } });
  expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
  expect(screen.getByRole("status").textContent).toBe("common.search.no_matches_found");
  fireEvent.keyDown(search, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  fireEvent.click(trigger);
  expect(await screen.findByRole("menuitem", { name: "web.workflow_ui.default_name" })).toBeTruthy();
  expect(screen.getAllByRole("menuitem")).toHaveLength(2);
});

it("switches through an ordinary link and reflects the next route through props", async () => {
  const workflows = [defaultWorkflow, persistedWorkflow];
  const { rerender } = render(<WorkflowSwitcher workflows={workflows} currentId="default" base={base} />);
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_ui.default_name" }));
  const target = await screen.findByRole("menuitem", { name: "Bug triage" });
  const navigation = vi.fn((event: Event) => event.preventDefault());
  target.addEventListener("click", navigation);
  fireEvent.click(target);
  expect(navigation).toHaveBeenCalledOnce();
  expect(target.getAttribute("href")).toBe(`${base}persisted-id`);
  expect(screen.getByRole("button", { name: "web.workflow_ui.default_name" })).toBeTruthy();
  rerender(<WorkflowSwitcher workflows={workflows} currentId="persisted-id" base={base} />);
  expect(screen.getByRole("button", { name: "Bug triage" })).toBeTruthy();
});
