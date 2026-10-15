import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { IProject } from "@plane/types";
import { ProjectCardProperties } from "./card-properties";
const mocks = vi.hoisted(() => ({ save: vi.fn(), toast: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "workspace" }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ updateProject: mocks.save }) }));
vi.mock("@/hooks/store/user", () => ({ useUserProfile: () => ({ data: { start_of_the_week: 1 } }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@/components/settings/workspace/configuration/project-fields", () => ({
  useProjectCategories: () => ({ labels: [] }),
}));
vi.mock("@/components/dropdowns/priority/priority-select", () => ({
  PrioritySelect: ({ onChange, disabled }: { onChange: (value: string) => void; disabled: boolean }) => (
    <button disabled={disabled} onClick={() => onChange("high")}>
      Priority
    </button>
  ),
}));
vi.mock("@/components/dropdowns/member/member-select", () => ({ MemberSelect: () => null }));
vi.mock("@plane/blocks/property-select", () => ({ LabelSelect: () => null, DateRangeSelect: () => null }));
beforeEach(() => vi.clearAllMocks());
it("saves card properties without triggering project navigation", async () => {
  const navigate = vi.fn();
  render(
    <a href="/project" onClick={navigate}>
      <ProjectCardProperties project={{ id: "project" } as IProject} disabled={false} />
    </a>
  );
  fireEvent.click(screen.getByRole("button", { name: "Priority" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith("workspace", "project", { priority: "high" }));
  expect(navigate).not.toHaveBeenCalled();
});
it("blocks changes without permission and recovers after a rejected save", async () => {
  const { rerender } = render(<ProjectCardProperties project={{ id: "project" } as IProject} disabled />);
  fireEvent.click(screen.getByRole("button"));
  expect(mocks.save).not.toHaveBeenCalled();
  rerender(<ProjectCardProperties project={{ id: "project" } as IProject} disabled={false} />);
  mocks.save.mockRejectedValueOnce(Error("failed"));
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() =>
    expect(mocks.toast).toHaveBeenCalledWith({ type: "error", title: "web.configuration_save_error" })
  );
  await waitFor(() => expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(false));
});
