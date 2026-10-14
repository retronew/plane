/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (["node_modules", "dist", "build", ".react-router", ".turbo"].includes(entry.name)) return [];
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
function keysOf(value: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, nested]) =>
    typeof nested === "string"
      ? [`${prefix}${key}`]
      : nested && typeof nested === "object"
        ? keysOf(nested as Record<string, unknown>, `${prefix}${key}.`)
        : []
  );
}

describe("literal translation references", () => {
  it("resolves application, block and editor translation calls in both supported review languages", () => {
    const catalogs = ["en", "zh-CN"].map(
      (locale) =>
        new Set(
          files(resolve(root, "packages/i18n/src/locales", locale))
            .filter((file) => file.endsWith(".json"))
            .flatMap((file) => keysOf(JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>))
        )
    );
    const missing: string[] = [];
    for (const directory of ["apps/web", "apps/admin", "apps/space", "packages/blocks/src", "packages/editor/src"]) {
      for (const file of files(resolve(root, directory)).filter(
        (path) => /\.(ts|tsx)$/.test(path) && !/\.(test|stories|d)\.tsx?$/.test(path)
      )) {
        const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
        function visit(node: ts.Node) {
          if (
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            ["t", "translate"].includes(node.expression.text)
          ) {
            const argument = node.arguments[0];
            if (argument) checkArgument(argument);
          }
          if (ts.isJsxAttribute(node) && node.name.getText() === "translationKey" && node.initializer) {
            checkArgument(ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer);
          }
          function checkArgument(argument: ts.Node | undefined) {
            if (!argument) return;
            if (ts.isConditionalExpression(argument)) {
              checkArgument(argument.whenTrue);
              checkArgument(argument.whenFalse);
            } else if (
              ts.isStringLiteral(argument) &&
              argument.text &&
              catalogs.some((catalog) => !catalog.has(argument.text))
            ) {
              const { line } = source.getLineAndCharacterOfPosition(argument.getStart());
              missing.push(`${file}:${line + 1}: ${argument.text}`);
            }
          }
          ts.forEachChild(node, visit);
        }
        visit(source);
      }
    }
    expect(missing).toEqual([]);
  });
});
