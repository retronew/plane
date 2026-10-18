import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ProfileSetup } from "./profile-setup";

vi.mock("@plane/i18n", () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ updateCurrentUser: vi.fn() }),
  useUserProfile: () => ({ updateUserProfile: vi.fn() }),
}));
vi.mock("@/services/auth.service", () => ({ AuthService: vi.fn() }));
vi.mock("@/components/core/modals/user-image-upload-modal", () => ({ UserImageUploadModal: () => null }));
vi.mock("@plane/blocks/auth", () => ({ PasswordStrengthIndicator: () => null }));

it("exposes role and domain choices as non-submitting buttons with selection state", () => {
  render(<ProfileSetup totalSteps={3} stepChange={vi.fn()} finishOnboarding={vi.fn()} />);
  const contributor = screen.getByRole("button", { name: "Individual contributor" });
  const manager = screen.getByRole("button", { name: "Manager" });
  const engineering = screen.getByRole("button", { name: "Engineering" });
  expect(contributor.getAttribute("type")).toBe("button");
  expect(contributor.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(contributor);
  expect(contributor.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(manager);
  expect(contributor.getAttribute("aria-pressed")).toBe("false");
  expect(manager.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(engineering);
  expect(engineering.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(engineering);
  expect(engineering.getAttribute("aria-pressed")).toBe("false");
});
