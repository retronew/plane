import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { IssueTypeSelect } from "./issue-type-select";
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/use-project-workflow", () => ({
  useProjectWorkflow: () => ({
    issueTypes: { p: { results: [{ id: "bug", name: "Bug", is_default: true, is_active: true }] } },
  }),
}));
vi.mock("@plane/blocks/select", () => {
  const context = { value: null as { name: string } | null };
  const Select = Object.assign(
    ({
      value,
      children,
      getValues,
    }: {
      value: { name: string } | null;
      children: ReactNode;
      getValues: () => { name: string }[];
    }) => {
      context.value = value;
      return (
        <div>
          {children}
          <span data-testid="options">
            {getValues()
              .map((type) => type.name)
              .join(",")}
          </span>
        </div>
      );
    },
    {
      Trigger: ({ children }: { children: (values: { name: string }[]) => ReactNode }) => (
        <div>{children(context.value ? [context.value] : [])}</div>
      ),
    }
  );
  return { Select };
});
it("shows the project default only for an omitted type", () => {
  render(<IssueTypeSelect projectId="p" value={undefined} onChange={() => undefined} />);
  expect(screen.getAllByText("Bug").length).toBeGreaterThan(0);
});
it("shows no type for an explicit null instead of claiming the default type", () => {
  render(<IssueTypeSelect projectId="p" value={null} onChange={() => undefined} />);
  expect(screen.getByText("web.workflow_ui.no_type")).toBeTruthy();
  expect(screen.getByText("web.workflow_ui.no_type")).toBeTruthy();
});

it("excludes illegal types including an otherwise default type", () => {
  render(<IssueTypeSelect projectId="p" allowedTypeIds={[]} onChange={() => undefined} />);
  expect(screen.getByTestId("options").textContent).toBe("");
  expect(screen.queryByText("Bug")).toBeNull();
});
it("offers a legal reusable type", () => {
  render(<IssueTypeSelect projectId="p" allowedTypeIds={["bug"]} onChange={() => undefined} />);
  expect(screen.getByTestId("options").textContent).toBe("Bug");
});
