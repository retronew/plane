import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { CreateProjectForm } from "./root";
const state = vi.hoisted(() => ({ create: vi.fn(), next: vi.fn() }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ createProject: state.create, updateProject: vi.fn(), addProjectToFavorites: vi.fn() }),
}));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));

vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@/components/project/create/header", () => ({
  default: ({ templatePicker }: { templatePicker: ReactNode }) => <div>{templatePicker}</div>,
}));
vi.mock("@/components/project/create/common-attributes", () => ({
  default: () => null,
  ProjectCreateDescription: () => null,
}));
vi.mock("@/components/project/create/project-create-buttons", () => ({
  default: () => <button type="submit">Create</button>,
}));
vi.mock("./attributes", () => ({ ProjectAttributes: () => null }));
vi.mock("@/components/settings/workspace/configuration/project-fields", () => ({ ProjectCategoryFields: () => null }));
vi.mock("@/components/settings/workspace/configuration/template-picker", () => ({
  TemplatePicker: ({ onApply }: { onApply: (value: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onApply({
          id: "template",
          title: "Starter project",
          name: "Starter",
          priority: "high",
          configuration: {
            description: "From template",
            network: 0,
            cycle_view: true,
            states: [{ name: "Ready", group: "unstarted", default: true }],
            labels: [{ name: "Platform" }],
            work_items: [{ name: "Setup" }],
          },
        })
      }
    >
      Apply template
    </button>
  ),
}));
beforeEach(() => {
  vi.clearAllMocks();
  state.create.mockResolvedValue({ id: "created-project" });
});
it.each([
  null,
  { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Previous description" }] }] },
])("applies a template over description JSON %j and submits all properties and children", async (descriptionText) => {
  render(
    <CreateProjectForm
      workspaceSlug="workspace"
      onClose={vi.fn()}
      handleNextStep={state.next}
      updateCoverImageStatus={vi.fn()}
      data={{
        start_date: "2026-10-15",
        target_date: "2026-10-20",
        member_ids: ["member-1"],
        description: "Previous description",
        description_html: "<p>Previous description</p>",
        description_text: descriptionText,
      }}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Apply template" }));
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await waitFor(() =>
    expect(state.create).toHaveBeenCalledWith(
      "workspace",
      expect.objectContaining({
        name: "Starter project",
        identifier: "STARTERPRO",
        description: "From template",
        description_html: null,
        description_text: null,
        network: 0,
        priority: "high",
        cycle_view: true,
        member_ids: ["member-1"],
        start_date: "2026-10-15",
        target_date: "2026-10-20",
        cover_image_url: "",
        template_configuration: expect.objectContaining({
          states: [{ name: "Ready", group: "unstarted", default: true }],
          labels: [{ name: "Platform" }],
          work_items: [{ name: "Setup" }],
        }),
      })
    )
  );
  expect(state.next).toHaveBeenCalledWith("created-project");
});

it("associates an uploaded relative cover URL after creating the project", async () => {
  const updateCoverImageStatus = vi.fn().mockResolvedValue(undefined);
  render(
    <CreateProjectForm
      workspaceSlug="workspace"
      onClose={vi.fn()}
      handleNextStep={state.next}
      updateCoverImageStatus={updateCoverImageStatus}
      data={{ name: "With cover", identifier: "COVER", cover_image_url: "/api/assets/v2/workspaces/workspace/asset/" }}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await waitFor(() =>
    expect(updateCoverImageStatus).toHaveBeenCalledWith("created-project", "/api/assets/v2/workspaces/workspace/asset/")
  );
  expect(state.create).toHaveBeenCalledTimes(1);
});

for (const boundary of ["close", "workspace", "unmount"] as const) {
  it(`ignores creation completion after ${boundary}`, async () => {
    let finish!: (value: { id: string }) => void;
    state.create.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const props = {
      workspaceSlug: "workspace",
      onClose: vi.fn(),
      handleNextStep: state.next,
      updateCoverImageStatus: vi.fn(),
    };
    const view = render(<CreateProjectForm {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(state.create).toHaveBeenCalledTimes(1));
    if (boundary === "unmount") view.unmount();
    else if (boundary === "workspace") view.rerender(<CreateProjectForm {...props} workspaceSlug="other" />);
    else {
      view.rerender(<CreateProjectForm {...props} isOpen={false} />);
      view.rerender(<CreateProjectForm {...props} isOpen />);
    }
    await act(async () => finish({ id: "old-project" }));
    expect(state.next).not.toHaveBeenCalled();
  });
}
