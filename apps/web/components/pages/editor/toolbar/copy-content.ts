/** Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only */
import type { EditorRefApi } from "@plane/editor";

export function pageHTMLToText(html: string): string {
  const document = new DOMParser().parseFromString(html, "text/html");
  document.querySelectorAll("script,style").forEach((node) => node.remove());
  document.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
  document.querySelectorAll("td,th").forEach((node) => node.append("\t"));
  document.querySelectorAll("p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,tr").forEach((node) => node.append("\n"));
  return (document.body.textContent ?? "")
    .replace(/\t\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function copyPageContent(
  editor: Pick<EditorRefApi, "getDocument" | "getMarkDown">,
  format: "text" | "markdown" | "html"
) {
  const content = format === "markdown" ? editor.getMarkDown() : editor.getDocument().html;
  await navigator.clipboard.writeText(format === "text" ? pageHTMLToText(content) : content);
}
