/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage, Translation } from "@plane/i18n";
import { PasswordInput } from "../auth/password/password-input";
import { Skeleton } from "../skeleton/root";
import { SelectOptionsSkeleton } from "../select/skeleton";
import { VirtualListSkeleton } from "../virtual-list/list-skeleton";

describe("localized sentences and shared defaults", () => {
  beforeEach(async () => {
    await setLanguage("zh-CN");
  });
  afterEach(async () => {
    await act(async () => {
      await setLanguage("en");
    });
  });

  it("reorders rich placeholders on language change and preserves interactive links", async () => {
    const click = vi.fn();
    const { container } = render(
      <Translation
        translationKey="web.activity.cycle_removed"
        components={{
          issue: (
            <a href="#issue" onClick={click}>
              PROJ-1
            </a>
          ),
          value: <a href="#cycle">Sprint 1</a>,
        }}
      />
    );
    expect(container.textContent).toBe("从周期Sprint 1移除了PROJ-1");
    await userEvent.setup().click(screen.getByRole("link", { name: "PROJ-1" }));
    expect(click).toHaveBeenCalledOnce();
    await act(async () => {
      await setLanguage("en");
    });
    expect(container.textContent).toBe("removed PROJ-1 from the cycle Sprint 1");
    expect(screen.getByRole("link", { name: "Sprint 1" }).getAttribute("href")).toBe("#cycle");
  });

  it("keeps numeric ICU pluralization and treats names as text", async () => {
    const { container, rerender } = render(<Translation translationKey="web.ui.duration_days" values={{ count: 2 }} />);
    expect(container.textContent).toBe("2 天");
    await act(async () => {
      await setLanguage("en");
    });
    expect(container.textContent).toBe("2 days");
    rerender(<Translation translationKey="web.ui.duration_days" values={{ count: 1 }} />);
    expect(container.textContent).toBe("1 day");
    rerender(
      <Translation translationKey="web.ui.activity_name" values={{ name: "<img src=x onerror=alert(1)> {name}" }} />
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<img src=x onerror=alert(1)> {name}");
  });

  it("translates password defaults and all loading announcements", () => {
    render(
      <>
        <PasswordInput id="password" value="" onChange={vi.fn()} />
        <Skeleton>
          <span />
        </Skeleton>
        <SelectOptionsSkeleton />
        <VirtualListSkeleton />
      </>
    );
    expect(screen.getByPlaceholderText("请输入密码")).toBeDefined();
    for (const name of ["正在加载内容", "正在加载选项", "正在加载更多行"]) {
      expect(screen.getByRole("status", { name })).toBeDefined();
    }
  });

  it("keeps explicitly supplied password hints and loading labels", () => {
    render(
      <>
        <PasswordInput id="password" value="" onChange={vi.fn()} placeholder="自定义密码提示" />
        <Skeleton ariaLabel="正在加载项目">
          <span />
        </Skeleton>
      </>
    );
    expect(screen.getByPlaceholderText("自定义密码提示")).toBeDefined();
    expect(screen.getByRole("status", { name: "正在加载项目" })).toBeDefined();
  });
});
