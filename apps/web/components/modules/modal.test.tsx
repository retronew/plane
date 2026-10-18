import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { CreateUpdateModuleModal } from "./modal";
const mocks = vi.hoisted(() => ({ createModule: vi.fn(), updateModuleDetails: vi.fn() }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@/hooks/store/use-module", () => ({ useModule: () => mocks }));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ workspaceProjectIds: ["project"] }) }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@/components/modules", () => ({
  ModuleForm: ({
    projectId,
    setActiveProject,
    handleFormSubmit,
  }: {
    projectId: string;
    setActiveProject: (id: string) => void;
    handleFormSubmit: (data: object) => Promise<void>;
  }) => (
    <>
      <output>{projectId}</output>
      <button onClick={() => setActiveProject("other")}>select</button>
      <button onClick={() => void handleFormSubmit({ name: "module" })}>submit</button>
    </>
  ),
}));
beforeEach(() => {
  mocks.createModule.mockReset().mockResolvedValue({});
});
it("resets project selection on reopen and ignores completion from the previous session", async () => {
  let finish!: () => void;
  mocks.createModule.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  const close = vi.fn();
  const props = { workspaceSlug: "test", projectId: "project", onClose: close };
  const { rerender } = render(<CreateUpdateModuleModal {...props} isOpen />);
  fireEvent.click(screen.getByText("select"));
  expect(screen.getByRole("status").textContent).toBe("other");
  fireEvent.click(screen.getByText("submit"));
  expect(mocks.createModule.mock.calls[0][1]).toBe("other");
  rerender(<CreateUpdateModuleModal {...props} isOpen={false} />);
  rerender(<CreateUpdateModuleModal {...props} isOpen />);
  expect(screen.getByRole("status").textContent).toBe("project");
  await act(async () => finish());
  expect(close).not.toHaveBeenCalled();
});
