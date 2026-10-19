import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { IApiToken } from "@plane/types";
import { GeneratedTokenDetails } from "./generated-token-details";

vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("../mcp-setup", () => ({ ApiTokenMcpSetup: () => null }));
vi.mock("@makeplane/propel/components/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@makeplane/propel/components/dialog", () => {
  const Part = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return Object.fromEntries(
    [
      "DialogActions",
      "DialogBody",
      "DialogDescription",
      "DialogHeader",
      "DialogHeading",
      "DialogInfo",
      "DialogMain",
      "DialogTitle",
    ].map((name) => [name, Part])
  );
});
afterEach(() => vi.restoreAllMocks());

describe("generated token copy", () => {
  it("copies the actual secret and only changes the icon with an accessible status", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(
      <GeneratedTokenDetails
        showMcpSetup={false}
        handleClose={vi.fn()}
        tokenDetails={{ token: "new-secret" } as IApiToken}
      />
    );
    const button = screen.getByRole("button", { name: "web.copy_secret_key" });
    await act(async () => fireEvent.click(button));
    expect(writeText).toHaveBeenCalledWith("new-secret");
    expect(screen.getByRole("status").textContent).toBe("common.copied");
    expect(button.querySelector(".lucide-check")?.classList.contains("opacity-100")).toBe(true);
    expect(button.querySelector(".lucide-copy")?.classList.contains("opacity-0")).toBe(true);
    expect(button.textContent).toBe("new-secretcommon.copied");
    expect(screen.getByRole("status").classList.contains("sr-only")).toBe(true);
  });
});
