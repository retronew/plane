import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ProfileSetupStep } from "./root";

const mocks = vi.hoisted(() => ({ updateCurrentUser: vi.fn(), updateUserProfile: vi.fn() }));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({
    data: { first_name: "Person", last_name: "", display_name: "OIDC Name", is_password_autoset: false },
    updateCurrentUser: mocks.updateCurrentUser,
  }),
  useUserProfile: () => ({ updateUserProfile: mocks.updateUserProfile }),
}));
vi.mock("@/hooks/store/use-instance", () => ({ useInstance: () => ({ config: { is_self_managed: true } }) }));
vi.mock("@/hooks/use-password-management", () => ({ usePasswordManagement: () => ({ canManagePassword: false }) }));
vi.mock("@/services/auth.service", () => ({ AuthService: vi.fn() }));
vi.mock("@/components/core/modals/user-image-upload-modal", () => ({ UserImageUploadModal: () => null }));
vi.mock("./set-password", () => ({ SetPasswordRoot: () => null }));
vi.mock("../common", () => ({ CommonOnboardingHeader: () => null }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateCurrentUser.mockResolvedValue(undefined);
});

it.each(["OIDC Name", "John Doe", "张三"])("prefills the OIDC name and explicitly submits %s", async (name) => {
  const handleStepChange = vi.fn();
  render(<ProfileSetupStep handleStepChange={handleStepChange} />);
  const input = screen.getByLabelText("display_name");
  expect((input as HTMLInputElement).value).toBe("OIDC Name");
  fireEvent.change(input, { target: { value: name } });
  fireEvent.submit(input.closest("form")!);
  await waitFor(() =>
    expect(mocks.updateCurrentUser).toHaveBeenCalledWith(expect.objectContaining({ display_name: name }))
  );
  await waitFor(() => expect(handleStepChange).toHaveBeenCalledOnce());
});

it("rejects a whitespace-only display name", async () => {
  render(<ProfileSetupStep handleStepChange={vi.fn()} />);
  const input = screen.getByLabelText("display_name");
  fireEvent.change(input, { target: { value: "   " } });
  fireEvent.submit(input.closest("form")!);
  await screen.findByText("web.display_name_is_required");
  expect(mocks.updateCurrentUser).not.toHaveBeenCalled();
});

it("stays on profile setup when saving fails", async () => {
  mocks.updateCurrentUser.mockRejectedValue(new Error("save failed"));
  const handleStepChange = vi.fn();
  render(<ProfileSetupStep handleStepChange={handleStepChange} />);
  fireEvent.submit(screen.getByLabelText("display_name").closest("form")!);
  await waitFor(() => expect(mocks.updateCurrentUser).toHaveBeenCalledOnce());
  expect(handleStepChange).not.toHaveBeenCalled();
  expect(mocks.updateUserProfile).not.toHaveBeenCalled();
});
