import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { McpCodePreview } from "./mcp-code-preview";
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("yace/highlighters/code", () => ({ code: () => ({}) }));
vi.mock("yace", () => ({
  Yace: class {
    textarea = document.createElement("textarea");
    constructor(container: HTMLElement, options: { value: string }) {
      this.textarea.value = options.value;
      container.appendChild(this.textarea);
    }
    destroy() {
      this.textarea.remove();
    }
  },
}));
describe("MCP code preview", () => {
  it("keeps an icon-only copy action inside the code frame and copies its own snippet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<McpCodePreview value="single-line-command" label="Client" />);
    const textarea = screen.getByRole("textbox", { name: "Client" }) as HTMLTextAreaElement;
    expect(textarea.readOnly).toBe(true);
    expect(textarea.parentElement?.classList.contains("pr-12")).toBe(true);
    const button = screen.getByRole("button", { name: "account_settings.mcp.copy_config" });
    expect(button.textContent).toBe("");
    await act(async () => fireEvent.click(button));
    expect(writeText).toHaveBeenCalledWith("single-line-command");
    expect(button.querySelector(".lucide-check")?.classList.contains("opacity-100")).toBe(true);
  });
});
