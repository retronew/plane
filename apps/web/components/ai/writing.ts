/** Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only */

export type WritingContext = { kind: "issue" | "page"; title: string; document: string; selection?: string };
export type WritingMode = "replace" | "append";
export const contextKey = (context: WritingContext) => JSON.stringify(context);
export const textToHtml = (text: string) =>
  text
    .trim()
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        `<p>${paragraph
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#x27;")
          .replace(/\n/g, "<br/>")}</p>`
    )
    .join("");
