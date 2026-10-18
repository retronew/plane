import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CreateProjectModal } from "./create-project-modal";

vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/use-can-create-project", () => ({ useCanCreateProject: () => true }));
vi.mock("@/services/file.service", () => ({ FileService: function FileService() {} }));
vi.mock("@makeplane/propel/components/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialogTitle: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/projects/create/root", () => ({
  CreateProjectForm: ({ handleNextStep }: { handleNextStep: (id: string) => void }) => (
    <>
      <input aria-label="name" defaultValue="" />
      <button onClick={() => handleNextStep("created")}>next</button>
    </>
  ),
}));
vi.mock("./project-feature-update", () => ({
  ProjectFeatureUpdate: ({ projectId }: { projectId: string }) => <output>{projectId}</output>,
}));

it("preserves the closing content and resets the step on reopening or switching workspace", () => {
  const props = { workspaceSlug: "workspace", onClose: vi.fn() };
  const view = render(<CreateProjectModal {...props} isOpen />);
  fireEvent.click(screen.getByText("next"));
  expect(screen.getByRole("status").textContent).toBe("created");
  view.rerender(<CreateProjectModal {...props} isOpen={false} />);
  expect(screen.getByRole("status").textContent).toBe("created");
  view.rerender(<CreateProjectModal {...props} isOpen />);
  expect(screen.getByRole("textbox").getAttribute("value")).toBe("");
  fireEvent.click(screen.getByText("next"));
  view.rerender(<CreateProjectModal {...props} workspaceSlug="other" isOpen />);
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByRole("textbox")).toBeTruthy();
});
