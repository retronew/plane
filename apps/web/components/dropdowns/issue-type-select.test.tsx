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
    ({ value, children }: { value: { name: string } | null; children: ReactNode }) => {
      context.value = value;
      return <div>{children}</div>;
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
  expect(screen.getByText("Bug")).toBeTruthy();
});
it("shows no type for an explicit null instead of claiming the default type", () => {
  render(<IssueTypeSelect projectId="p" value={null} onChange={() => undefined} />);
  expect(screen.getByText("web.workflow_ui.no_type")).toBeTruthy();
  expect(screen.queryByText("Bug")).toBeNull();
});
