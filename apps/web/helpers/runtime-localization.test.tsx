/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { setLanguage, translate } from "@plane/i18n";
import {
  PAST_DURATION_FILTER_OPTIONS,
  PROJECT_CREATED_AT_FILTER_OPTIONS,
  DATE_AFTER_FILTER_OPTIONS,
} from "@plane/constants";
import { authErrorHandler, EAuthenticationErrorCodes } from "./authentication.helper";
import { TermsAndConditions } from "../components/account/terms-and-conditions";

// Runtime import keeps Space source out of the Web composite TS project.
const spaceAuthPath = resolve(import.meta.dirname, "../../../apps/space/helpers/authentication.helper.tsx");
const spaceAuth = (await import(spaceAuthPath)) as {
  authErrorHandler: (code: string, email?: string) => ReturnType<typeof authErrorHandler>;
  EAuthenticationErrorCodes: Record<string, string>;
};
const markup = (node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);

afterEach(async () => {
  await setLanguage("en");
});

describe("runtime localization", () => {
  it("localizes every Web and Space authentication error, including rich links", async () => {
    await setLanguage("zh-CN");
    for (const [handler, codes] of [
      [authErrorHandler, Object.values(EAuthenticationErrorCodes)],
      [spaceAuth.authErrorHandler, Object.values(spaceAuth.EAuthenticationErrorCodes)],
    ] as const) {
      for (const code of codes) {
        const error = (handler as typeof spaceAuth.authErrorHandler)(code, "reader+test@example.com");
        expect(error, code).toBeDefined();
        expect(error?.title, code).toMatch(/[\u4e00-\u9fff]/);
        const content = markup(error?.message);
        expect(content, code).toMatch(/[\u4e00-\u9fff]/);
        expect(content, code).not.toMatch(/web\.(?:runtime|auth_errors)\.|Please try|now\.|to get started/);
      }
    }
    const existing = markup(
      authErrorHandler(EAuthenticationErrorCodes.USER_ALREADY_EXIST, "reader+test@example.com")?.message
    );
    expect(existing).toContain("您的账户已注册");
    expect(existing).toContain("email=reader%2Btest%40example.com");
    await setLanguage("en");
    expect(authErrorHandler(EAuthenticationErrorCodes.INVALID_PASSWORD)?.title).toBe("Invalid password");
  });

  it("formats zero and plural counts, and resolves date presets after language changes", async () => {
    await setLanguage("zh-CN");
    expect(translate("web.runtime.priority_enum_value", { priority: "none" })).toBe("优先级：无");
    expect(translate("web.runtime.priority_enum_value", { priority: "urgent" })).toBe("优先级：紧急");
    expect(translate("web.runtime.filter_label", { count: 0 })).toBe("标签");
    expect(translate("web.runtime.filter_label", { count: 2 })).toBe("标签（2）");
    expect(translate("web.runtime.items_count", { count: 0 })).toBe("0 个工作项");
    expect(PAST_DURATION_FILTER_OPTIONS.map((option) => option.name)).toEqual([
      "今天",
      "昨天",
      "过去 7 天",
      "过去 30 天",
    ]);
    expect(PROJECT_CREATED_AT_FILTER_OPTIONS[0].name).toBe("今天");
    expect(DATE_AFTER_FILTER_OPTIONS[1].name).toBe("2 周后");
    await setLanguage("en");
    expect(translate("web.runtime.items_count", { count: 1 })).toBe("1 work item");
    expect(translate("web.runtime.items_count", { count: 2 })).toBe("2 work items");
    expect(PAST_DURATION_FILTER_OPTIONS[0].name).toBe("Today");
  });

  it("renders legal links inside a complete Chinese sentence", async () => {
    await setLanguage("zh-CN");
    const content = markup(<TermsAndConditions />);
    expect(content).toContain("登录即表示您同意我们的");
    expect(content).toContain('href="https://plane.so/legals/terms-and-conditions"');
    expect(content).toContain('href="https://plane.so/legals/privacy-policy"');
    expect(content).not.toContain("you agree");
  });
});
