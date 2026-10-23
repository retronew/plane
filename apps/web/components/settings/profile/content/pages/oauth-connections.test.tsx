import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OAuthProfileSettings } from "./oauth-connections";
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/api-token/oauth-connections", () => ({ OAuthConnections: () => <div>Authorized clients</div> }));
vi.mock("@/components/api-token/plugin-setup", () => ({ ApiTokenPluginSetup: () => <div>Plugin installation</div> }));
vi.mock("@/components/settings/profile/heading", () => ({
  ProfileSettingsHeading: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
describe("Authorizations and plugins", () => {
  it("shows authorizations without plugin installation tabs", () => {
    render(<OAuthProfileSettings />);
    expect(screen.getByText("Authorized clients")).toBeTruthy();
    expect(screen.queryByText("Plugin installation")).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
  });
});
