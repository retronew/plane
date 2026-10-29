import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { IUser, TUserProfile } from "@plane/types";
import { GeneralProfileSettingsForm } from "./form";

const mocks = vi.hoisted(() => ({ updateCurrentUser: vi.fn(), updateUserProfile: vi.fn() }));
vi.mock("@plane/i18n", () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: { display_name: "wuzuo" }, updateCurrentUser: mocks.updateCurrentUser }),
  useUserProfile: () => ({ updateUserProfile: mocks.updateUserProfile }),
}));
vi.mock("@/hooks/store/use-instance", () => ({ useInstance: () => ({ config: {} }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn(), setPromiseToast: vi.fn() }));
vi.mock("@/components/account/deactivate-account-modal", () => ({ DeactivateAccountModal: () => null }));
vi.mock("@/components/core/modals/change-email-modal", () => ({ ChangeEmailModal: () => null }));
vi.mock("@/components/core/modals/user-image-upload-modal", () => ({ UserImageUploadModal: () => null }));
vi.mock("@/components/core/cover-image-upload-button", () => ({ CoverImageUploadButton: () => null }));
vi.mock("@/components/common/cover-image", () => ({ CoverImage: () => null }));
vi.mock("./sso-link", () => ({ ProfileSSOLink: () => null }));

const user = { first_name: "吴佐", last_name: "", display_name: "wuzuo", email: "person@example.com" } as IUser;
const profile = { role: "Product / Project Manager" } as TUserProfile;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateCurrentUser.mockResolvedValue(user);
});

it.each(["John Doe", "吴佐"])("saves display name %s with an empty last name", async (name) => {
  render(<GeneralProfileSettingsForm user={user} profile={profile} />);
  fireEvent.change(screen.getByLabelText(/display_name/), { target: { value: name } });
  fireEvent.submit(screen.getByLabelText(/display_name/).closest("form")!);
  await waitFor(() =>
    expect(mocks.updateCurrentUser).toHaveBeenCalledWith(expect.objectContaining({ display_name: name, last_name: "" }))
  );
});

it("rejects an invalid nonempty last name", async () => {
  render(<GeneralProfileSettingsForm user={user} profile={profile} />);
  fireEvent.change(screen.getByLabelText("last_name"), { target: { value: "<invalid>" } });
  fireEvent.submit(screen.getByLabelText("last_name").closest("form")!);
  await screen.findByText("Names cannot contain special characters like < > ' \" { } [ ] * ^ ! # %");
  expect(mocks.updateCurrentUser).not.toHaveBeenCalled();
});
