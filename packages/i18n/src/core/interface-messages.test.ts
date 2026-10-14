/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";
import en from "../locales/en/web.json";
import zh from "../locales/zh-CN/web.json";

function flatten(messages: Record<string, unknown>, prefix = ""): Record<string, string> {
  return Object.fromEntries(
    Object.entries(messages).flatMap(([key, value]) =>
      typeof value === "string"
        ? [[`${prefix}${key}`, value]]
        : Object.entries(flatten(value as Record<string, unknown>, `${prefix}${key}.`))
    )
  );
}

const english = flatten(en.web);
const chinese = flatten(zh.web);
const keys = Object.keys(english).filter((key) =>
  /^(runtime|ui|activity|project_activity|notifications|plan_features)\./.test(key)
);
const argumentsOf = (message: string): string[] => {
  const names = new Set<string>();
  function visit(elements: ReturnType<IntlMessageFormat["getAst"]>) {
    for (const element of elements) {
      if (element.type !== 0 && element.type !== 7) names.add(element.value);
      if ("options" in element) {
        Object.values(element.options).forEach((option) => visit(option.value));
      }
      if ("children" in element) visit(element.children);
    }
  }
  visit(new IntlMessageFormat(message).getAst());
  return [...names].toSorted();
};

describe("interface message catalogs", () => {
  it.each(keys)("keeps %s translated with matching ICU placeholders", (key) => {
    expect(chinese[key]).toBeTruthy();
    expect(argumentsOf(chinese[key])).toEqual(argumentsOf(english[key]));
    const values = Object.fromEntries(
      argumentsOf(english[key]).map((name) => [
        name,
        ["count", "total", "current", "progress"].includes(name) ? 2 : "示例",
      ])
    );
    expect(() => new IntlMessageFormat(english[key], "en").format(values)).not.toThrow();
    expect(() => new IntlMessageFormat(chinese[key], "zh-CN").format(values)).not.toThrow();
  });
});
