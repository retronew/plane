import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { APITokensProfileSettings } from "../settings/profile/content/pages/api-tokens";

vi.mock("@plane/i18n", () => ({
  getCurrentLanguage: () => "en",
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock("@plane/services", () => ({ APITokenService: vi.fn(function APITokenService() {}) }));
vi.mock("swr", () => ({
  default: () => ({
    data: [
      {
        id: "a",
        label: "Build integration",
        description: "Release pipeline",
        is_active: true,
        scope: "read",
        created_at: "2026-10-10T10:00:00Z",
        expired_at: null,
        last_used: null,
        token: "SECRET_MUST_NOT_APPEAR",
      },
      {
        id: "b",
        label: "Old integration",
        description: "",
        is_active: false,
        created_at: "2026-10-01T10:00:00Z",
        expired_at: "2026-10-11T10:00:00Z",
        last_used: "2026-10-10T12:00:00Z",
      },
    ],
  }),
}));
vi.mock("@/components/api-token/modal/create-token-modal", () => ({ CreateApiTokenModal: () => null }));
vi.mock("@/components/api-token/delete-token-modal", () => ({
  DeleteApiTokenModal: ({ isOpen, tokenId }: { isOpen: boolean; tokenId: string }) =>
    isOpen ? <dialog open>Delete {tokenId}</dialog> : null,
}));

describe("personal access token table", () => {
  it("shows status, dates and usage without exposing secrets, and clears filtering with focus retained", () => {
    render(<APITokensProfileSettings />);
    expect(screen.getAllByRole("columnheader")).toHaveLength(6);
    expect(screen.getByText("web.token_never_used")).toBeTruthy();
    expect(screen.queryByText("SECRET_MUST_NOT_APPEAR")).toBeNull();
    const search = screen.getByRole("textbox", { name: "web.search_access_tokens" });
    fireEvent.change(search, { target: { value: "release" } });
    expect(screen.getByText("Build integration")).toBeTruthy();
    expect(screen.queryByText("Old integration")).toBeNull();
    fireEvent.change(search, { target: { value: "no matching token" } });
    expect(screen.getByText("common.search.no_matches_found")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "web.clear_token_search" }));
    expect(screen.getByText("Old integration")).toBeTruthy();
    expect(document.activeElement).toBe(search);
    expect(screen.queryByRole("button", { name: "web.clear_token_search" })).toBeNull();
  });
});
