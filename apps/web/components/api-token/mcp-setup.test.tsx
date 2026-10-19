import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ApiTokenMcpSetup } from "./mcp-setup";

const { copyTextToClipboard } = vi.hoisted(() => ({ copyTextToClipboard: vi.fn().mockResolvedValue(undefined) }));
Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copyTextToClipboard } });
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/constants", () => ({ API_BASE_URL: "" }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: { name?: string }) => (params?.name ? `${key}:${params.name}` : key),
  }),
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@plane/utils", () => ({ cn: (...classes: string[]) => classes.filter(Boolean).join(" ") }));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: undefined }) }));
vi.mock("@/hooks/store/use-workspace", () => ({ useWorkspace: () => ({ workspaces: {} }) }));
vi.mock("./mcp-code-preview", () => ({ McpCodePreview: ({ value }: { value: string }) => <pre>{value}</pre> }));

describe("MCP client setup", () => {
  it("keeps code hidden until the client code button is opened", async () => {
    render(<ApiTokenMcpSetup />);
    expect(screen.queryByText(/claude mcp add --transport/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "account_settings.mcp.view_code:Claude Code" }));
    expect(await screen.findByText(/claude mcp add --transport/)).toBeTruthy();
    expect(screen.getByText(/claude mcp add --transport/).textContent).toContain("YOUR_PERSONAL_API_TOKEN");
  });

  it("enables one-click setup only after a token is entered", () => {
    render(<ApiTokenMcpSetup />);
    const installButtons = screen.getAllByRole("button", { name: "account_settings.mcp.add" });
    expect(
      installButtons.every(
        (button) => button.getAttribute("aria-disabled") === "true" || (button as HTMLButtonElement).disabled
      )
    ).toBe(true);
    fireEvent.change(screen.getByLabelText("account_settings.mcp.token_label"), {
      target: { value: "personal-token" },
    });
    expect(
      installButtons.every(
        (button) => !button.hasAttribute("disabled") && button.getAttribute("aria-disabled") !== "true"
      )
    ).toBe(true);
  });

  it("copies the supplied token in a shell install command", async () => {
    render(<ApiTokenMcpSetup token="fresh-personal-token" />);
    fireEvent.click(screen.getByRole("button", { name: "account_settings.mcp.copy_command" }));
    await waitFor(() =>
      expect(copyTextToClipboard).toHaveBeenCalledWith(expect.stringContaining("Bearer fresh-personal-token"))
    );
  });

  it("renders on the server without reading window", () => {
    vi.stubGlobal("window", undefined);
    try {
      expect(renderToString(<ApiTokenMcpSetup />)).toContain("/mcp");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("uses the browser origin when no API base URL is configured", () => {
    render(<ApiTokenMcpSetup />);
    expect(screen.getByText(`${window.location.origin}/mcp`, { exact: false })).toBeTruthy();
  });
});
