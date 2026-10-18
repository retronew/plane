import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ApiTokenMcpSetup } from "./mcp-setup";

vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/constants", () => ({ API_BASE_URL: "" }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@plane/utils", () => ({ copyTextToClipboard: vi.fn() }));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: undefined }) }));
vi.mock("@/hooks/store/use-workspace", () => ({ useWorkspace: () => ({ workspaces: {} }) }));

describe("API token MCP endpoint", () => {
  it("renders on the server without reading window", () => {
    vi.stubGlobal("window", undefined);
    try {
      expect(renderToString(<ApiTokenMcpSetup token="test-token" />)).toContain("/mcp");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("uses the browser origin when no API base URL is configured", () => {
    render(<ApiTokenMcpSetup token="test-token" />);
    expect(screen.getByText(/claude mcp add --transport/).textContent).toContain(`${window.location.origin}/mcp`);
  });
});
