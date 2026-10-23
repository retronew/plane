import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiTokenMcpSetup } from "./mcp-setup";

const { copyTextToClipboard } = vi.hoisted(() => ({
  copyTextToClipboard: vi.fn().mockResolvedValue(undefined),
}));
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
vi.mock("./mcp-code-preview", () => ({ McpCodePreview: ({ value }: { value: string }) => <pre>{value}</pre> }));

describe("MCP client setup", () => {
  beforeEach(() => {
    copyTextToClipboard.mockClear();
  });

  it("connects with only URL and token and offers no workspace selector", async () => {
    render(<ApiTokenMcpSetup token="personal-token" />);
    expect(screen.queryByRole("combobox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "account_settings.mcp.copy_command" }));
    await waitFor(() => expect(copyTextToClipboard).toHaveBeenCalledTimes(1));
    expect(copyTextToClipboard.mock.calls[0][0]).not.toContain("X-Workspace-Slug");
    fireEvent.click(screen.getByRole("button", { name: "account_settings.mcp.view_code:ChatGPT" }));
    expect((await screen.findByText(/"authentication": "oauth"/)).textContent).not.toContain("http_headers");
    fireEvent.click(screen.getByRole("button", { name: "account_settings.mcp.view_code:VS Code" }));
    expect((await screen.findByText(/"servers"/)).textContent).not.toContain("X-Workspace-Slug");
    fireEvent.click(screen.getByRole("button", { name: "account_settings.mcp.agent_prompt_label:ChatGPT" }));
    await waitFor(() => expect(copyTextToClipboard).toHaveBeenCalledTimes(2));
    expect(copyTextToClipboard.mock.calls[1][0]).not.toContain('"workspaceSlug"');
  });

  it("keeps code hidden until the client code button is opened", async () => {
    render(<ApiTokenMcpSetup />);
    expect(screen.queryByText(/claude mcp add --transport/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "account_settings.mcp.view_code:Claude Code" }));
    expect(await screen.findByText(/claude mcp add --transport/)).toBeTruthy();
    expect(screen.getByText(/claude mcp add --transport/).textContent).toContain("YOUR_PERSONAL_API_TOKEN");
  });

  it("allows one-click setup without collecting a token", () => {
    render(<ApiTokenMcpSetup />);
    expect(screen.queryByLabelText("account_settings.mcp.token_label")).toBeNull();
    const installButtons = screen.getAllByRole("button", { name: "account_settings.mcp.add" });
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

  it.each([
    ["ChatGPT", "https://learn.chatgpt.com/docs/extend/mcp?surface=cli"],
    ["Codex", "https://developers.openai.com/codex/extend/mcp"],
    ["Windsurf", "https://docs.devin.ai/desktop/cascade/mcp"],
    ["Cline", "https://docs.cline.bot/mcp/mcp-overview"],
    ["Roo Code", "https://roocodeinc.github.io/Roo-Code/features/mcp/using-mcp-in-roo/"],
  ])("opens the official %s MCP setup guide", (name, url) => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    try {
      render(<ApiTokenMcpSetup />);
      fireEvent.click(screen.getByRole("button", { name: "account_settings.mcp.more_tools" }));
      const row = screen.getByText(name).parentElement!;
      fireEvent.click(within(row).getByRole("button", { name: "account_settings.mcp.guide" }));
      expect(open).toHaveBeenCalledWith(url, "_blank", "noopener,noreferrer");
    } finally {
      open.mockRestore();
    }
  });

  it("copies a client-specific agent prompt without exposing the supplied token", async () => {
    render(<ApiTokenMcpSetup token="private-token-never-in-prompt" />);
    fireEvent.click(screen.getByRole("button", { name: "account_settings.mcp.more_tools" }));
    fireEvent.click(screen.getByRole("button", { name: "account_settings.mcp.agent_prompt_label:Codex" }));
    await waitFor(() =>
      expect(copyTextToClipboard).toHaveBeenCalledWith(expect.stringContaining("~/.codex/config.toml"))
    );
    const prompt = copyTextToClipboard.mock.calls.at(-1)?.[0] as string;
    expect(prompt).not.toContain("private-token-never-in-prompt");
    expect(prompt).not.toContain("/skills/plane-workflow");
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
