import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { WorkspaceTemplate } from "@/services/workspace-configuration.service";
import { TemplatePicker } from "./template-picker";

const mocks = vi.hoisted(() => ({ templates: [] as WorkspaceTemplate[] }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("swr", () => ({ default: () => ({ data: mocks.templates }) }));
vi.mock("./select", () => ({
  ConfigurationSelect: ({
    options,
    onChange,
    value,
  }: {
    options: { value: string; label: string }[];
    onChange: (v: string) => void;
    value: string;
  }) => (
    <select aria-label="templates" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choose template</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

const template = (id: string, kind: WorkspaceTemplate["kind"], project: string | null = null): WorkspaceTemplate => ({
  id,
  kind,
  project,
  name: id,
  title: `${id} title`,
  description_html: `<p>${id}</p>`,
  short_description: "",
  priority: "none",
  configuration: {},
});

beforeEach(() => {
  mocks.templates = [
    template("global", "work_item"),
    template("project-one", "work_item", "one"),
    template("project-two", "work_item", "two"),
    template("page", "page"),
  ];
});

it("offers global and current project templates of the requested kind and applies explicitly", () => {
  const apply = vi.fn();
  render(<TemplatePicker workspaceSlug="test" projectId="one" kind="work_item" onApply={apply} />);
  expect(screen.getByRole("option", { name: "global" })).toBeTruthy();
  expect(screen.getByRole("option", { name: "project-one" })).toBeTruthy();
  expect(screen.queryByRole("option", { name: "project-two" })).toBeNull();
  expect(screen.queryByRole("option", { name: "page" })).toBeNull();
  fireEvent.change(screen.getByLabelText("templates"), { target: { value: "project-one" } });
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "web.apply_template" }));
  expect(apply).toHaveBeenCalledWith(mocks.templates[1]);
});

it("keeps legacy workspace templates with no project and excludes scoped templates without a destination", () => {
  mocks.templates.push({ ...template("legacy", "work_item"), project: undefined } as unknown as WorkspaceTemplate);
  render(<TemplatePicker workspaceSlug="test" kind="work_item" onApply={vi.fn()} />);
  expect(screen.getByRole("option", { name: "global" })).toBeTruthy();
  expect(screen.getByRole("option", { name: "legacy" })).toBeTruthy();
  expect(screen.queryByRole("option", { name: "project-one" })).toBeNull();
  expect(screen.queryByRole("option", { name: "project-two" })).toBeNull();
});

it.each(["project", "kind", "workspace"])("clears selection on a %s switch", (scope) => {
  const apply = vi.fn();
  const props = { workspaceSlug: "test", projectId: "one", kind: "work_item" as const, onApply: apply };
  const { rerender } = render(<TemplatePicker {...props} />);
  fireEvent.change(screen.getByLabelText("templates"), { target: { value: "global" } });
  rerender(
    <TemplatePicker
      {...props}
      projectId={scope === "project" ? "two" : props.projectId}
      kind={scope === "kind" ? "page" : props.kind}
      workspaceSlug={scope === "workspace" ? "another" : props.workspaceSlug}
    />
  );
  expect((screen.getByLabelText("templates") as HTMLSelectElement).value).toBe("");
  expect(screen.getByRole("button", { name: "web.apply_template" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "web.apply_template" }));
  expect(apply).not.toHaveBeenCalled();
});

it("cannot apply a template removed from the available list", () => {
  const apply = vi.fn();
  const { rerender } = render(<TemplatePicker workspaceSlug="test" projectId="one" kind="work_item" onApply={apply} />);
  fireEvent.change(screen.getByLabelText("templates"), { target: { value: "project-one" } });
  mocks.templates = [template("global", "work_item")];
  rerender(<TemplatePicker workspaceSlug="test" projectId="one" kind="work_item" onApply={apply} />);
  fireEvent.click(screen.getByRole("button", { name: "web.apply_template" }));
  expect(apply).not.toHaveBeenCalled();
});
