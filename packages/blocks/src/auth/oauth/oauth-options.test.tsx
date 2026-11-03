import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { OAuthOptions } from "./oauth-options";

it("keeps team labels visible in the password step and hides disabled entries", () => {
  render(
    <OAuthOptions
      compact
      showDivider={false}
      options={[
        { id: "oidc:chengdu", text: "成都水月雨科技飞书", icon: <span />, onClick: vi.fn() },
        { id: "oidc:moondrop", text: "水月雨飞书", icon: <span />, onClick: vi.fn() },
        { id: "oidc:hidden", text: "Disabled team", icon: <span />, onClick: vi.fn(), enabled: false },
      ]}
    />
  );
  expect(screen.getByRole("button", { name: "成都水月雨科技飞书" }).textContent).toContain("成都水月雨科技飞书");
  expect(screen.getByRole("button", { name: "水月雨飞书" }).textContent).toContain("水月雨飞书");
  expect(screen.queryByRole("button", { name: "Disabled team" })).toBeNull();
});
