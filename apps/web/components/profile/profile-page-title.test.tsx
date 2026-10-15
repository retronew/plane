import { act, render, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import ProfileIssuesTypePage from "@/app/(all)/[workspaceSlug]/(projects)/profile/[userId]/[profileViewId]/page";
vi.mock("@/components/profile/profile-issues", () => ({ ProfileIssuesPage: () => null }));
beforeEach(async () => {
  await setLanguage("zh-CN");
});
afterEach(async () => {
  await act(() => setLanguage("en"));
});
it.each([
  ["assigned", "已分配"],
  ["created", "已创建"],
  ["subscribed", "已订阅"],
])("localizes the %s browser title and follows a language change", async (view, title) => {
  const props = { params: { profileViewId: view } } as ComponentProps<typeof ProfileIssuesTypePage>;
  render(<ProfileIssuesTypePage {...props} />);
  await waitFor(() => expect(document.title).toBe(`我的工作 - ${title}`));
  await act(() => setLanguage("en"));
  await waitFor(() => expect(document.title).toBe(`My work - ${view[0].toUpperCase()}${view.slice(1)}`));
});
