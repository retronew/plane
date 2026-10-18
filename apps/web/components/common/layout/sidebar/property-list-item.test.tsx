import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { SidebarPropertyListItem } from "./property-list-item";

const Icon = ({ className }: { className?: string }) => <svg className={className} aria-hidden />;

it("keeps existing sidebar sizing and top alignment by default", () => {
  const { container } = render(
    <SidebarPropertyListItem icon={Icon} label="Assignees">
      <span>Alice</span>
    </SidebarPropertyListItem>
  );
  expect(container.firstElementChild?.className).toContain("items-start");
  expect(screen.getByText("Assignees").parentElement?.className).toContain("w-30");
});

it("centers detail rows with a bounded label column and wrapping values", () => {
  const name = "A very long assignee name ".repeat(8);
  const { container } = render(
    <SidebarPropertyListItem icon={Icon} label="Assignees" variant="detail" childrenClassName="px-2">
      <span>{name}</span>
    </SidebarPropertyListItem>
  );
  expect(container.firstElementChild?.className).toContain("min-h-8");
  expect(container.firstElementChild?.className).toContain("items-center");
  expect(screen.getByText("Assignees").parentElement?.className).toContain("w-[clamp(120px,25%,160px)]");
  const value = screen.getByText(name.trim()).parentElement;
  expect(value?.className).toContain("min-w-0");
  expect(value?.className).toContain("break-words");
  expect(value?.className).toContain("flex-wrap");
  expect(value?.className).toContain("px-2");
});
