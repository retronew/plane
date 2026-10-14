/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import { ProjectSelect } from "./project-select";
import { StateSelect } from "./state-select";
import { CycleSelect } from "./cycle-select";
import { ModuleSelect } from "./module-select";
import { EstimateSelect } from "./estimate-select";
import { LabelSelect } from "./label-select/label-select";
import { MemberSelect } from "./member-select";

const getValues = async () => ({ results: [], next_page_results: false, count: 0, total_count: 0 });
const props = { getValues, onChange: vi.fn(), variant: "pill-md" as const, placeholder: "选择" };

describe("property picker localization", () => {
  beforeEach(async () => {
    await setLanguage("zh-CN");
  });
  afterEach(async () => {
    await act(async () => {
      await setLanguage("en");
    });
  });

  it.each([
    ["projects", <ProjectSelect key="ProjectSelect" {...props} value={null} />, "搜索项目"],
    ["multiple projects", <ProjectSelect key="ProjectSelect" {...props} multiple value={[]} />, "搜索项目"],
    ["states", <StateSelect key="StateSelect" {...props} value={null} />, "搜索状态…"],
    ["cycles", <CycleSelect key="CycleSelect" {...props} value={null} clearable={false} />, "搜索周期…"],
    ["modules", <ModuleSelect key="ModuleSelect" {...props} value={null} />, "搜索模块…"],
    ["multiple modules", <ModuleSelect key="ModuleSelect" {...props} multiple value={[]} />, "搜索模块…"],
    ["estimates", <EstimateSelect key="EstimateSelect" {...props} value={null} clearable={false} />, "搜索估算"],
    ["labels", <LabelSelect key="LabelSelect" {...props} value={[]} />, "搜索标签…"],
    ["members", <MemberSelect key="MemberSelect" {...props} multiple value={[]} />, "搜索成员…"],
  ])("translates search and empty results for %s", async (_name, picker, search) => {
    const user = userEvent.setup();
    render(picker);
    await user.click(screen.getByRole("button", { name: "选择" }));
    expect(await screen.findByPlaceholderText(search)).toBeDefined();
    expect(await screen.findByText(_name === "labels" ? "没有匹配的标签" : "未找到结果")).toBeDefined();
  });

  it.each([
    ["projects", ProjectSelect, "2 个项目"],
    ["modules", ModuleSelect, "2 个模块"],
  ])("translates multiple selection counts for %s", (_name, Picker, label) => {
    render(
      <Picker
        {...props}
        multiple
        value={[
          { id: "a", name: "Alpha" },
          { id: "b", name: "Beta" },
        ]}
      />
    );
    expect(screen.getByText(label)).toBeDefined();
  });

  it("updates an open picker when the language changes", async () => {
    const user = userEvent.setup();
    render(<ProjectSelect key="ProjectSelect" {...props} value={null} />);
    await user.click(screen.getByRole("button", { name: "选择" }));
    expect(await screen.findByPlaceholderText("搜索项目")).toBeDefined();
    await act(async () => {
      await setLanguage("en");
    });
    expect(await screen.findByPlaceholderText("Search for projects")).toBeDefined();
    expect(await screen.findByText("No results found")).toBeDefined();
  });

  it("preserves a caller's search placeholder", async () => {
    const user = userEvent.setup();
    render(<ProjectSelect key="ProjectSelect" {...props} value={null} searchPlaceholder="按项目编号搜索" />);
    await user.click(screen.getByRole("button", { name: "选择" }));
    expect(await screen.findByPlaceholderText("按项目编号搜索")).toBeDefined();
  });
});
