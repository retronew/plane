import { render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { WorkItemTypeIcon } from "./work-item-type-icon";

vi.mock("use-font-face-observer", () => ({ default: () => true }));
vi.mock("@/hooks/store/use-project-workflow", () => ({
  useProjectWorkflow: () => ({
    issueTypes: {
      alpha: {
        results: [
          { id: "bug", name: "Bug", is_active: false, logo_props: { in_use: "emoji", emoji: { value: "128027" } } },
          { id: "task", name: "Task", is_default: true, logo_props: { in_use: "emoji", emoji: { value: "128203" } } },
          { id: "feature", name: "Feature", logo_props: { in_use: "icon", icon: { name: "star", color: "#f59e0b" } } },
        ],
      },
      beta: { results: [{ id: "bug", name: "Issue", logo_props: { in_use: "emoji", emoji: { value: "128640" } } }] },
    },
  }),
}));

it("renders the assigned type's real logo, including inactive types, scoped to its project", () => {
  const { container, rerender } = render(<WorkItemTypeIcon projectId="alpha" typeId="bug" />);
  expect(container.querySelector("[data-work-item-type-icon]")?.textContent).toBe(String.fromCodePoint(128027));
  rerender(<WorkItemTypeIcon projectId="beta" typeId="bug" />);
  expect(container.querySelector("[data-work-item-type-icon]")?.textContent).toBe(String.fromCodePoint(128640));
});

it("matches the hosted 16px frame, 12px glyph and 25% type-color background", () => {
  const { container } = render(<WorkItemTypeIcon projectId="alpha" typeId="feature" />);
  const frame = container.querySelector<HTMLElement>("[data-work-item-type-icon]");
  expect(frame?.classList.contains("size-4")).toBe(true);
  expect(frame?.classList.contains("rounded-sm")).toBe(true);
  expect(frame?.style.backgroundColor).toBe("color-mix(in srgb, rgb(245, 158, 11) 25%, transparent)");
  expect(container.querySelector<HTMLElement>("[data-logo-icon]")?.style.width).toBe("12px");
  expect(container.querySelector<HTMLElement>(".material-symbols-rounded")?.style.fontSize).toBe("12px");
});

it.each([null, undefined, "missing"])(
  "uses the work-item fallback for type %s without assigning a default type",
  (typeId) => {
    const { container } = render(<WorkItemTypeIcon projectId="alpha" typeId={typeId} />);
    expect(container.querySelector("[data-work-item-type-icon]")?.getAttribute("data-work-item-type-icon")).toBe("");
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector("[data-work-item-type-icon]")?.textContent).toBe("");
  }
);
