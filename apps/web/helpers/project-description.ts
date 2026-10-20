import { convertHTMLToMarkdown } from "@plane/utils";

/** Legacy descriptions are text/Markdown, never trusted HTML. */
export function projectDescriptionToHTML(description: string): string {
  const escaped = description
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<p>${escaped.replace(/\n/g, "<br>")}</p>`;
}

export function projectDescriptionToMarkdown(descriptionHtml: string): string {
  return convertHTMLToMarkdown({
    description_html: descriptionHtml,
    metaData: { file_assets: [], user_mentions: [] },
  });
}
