import { SandboxAssetsProvider } from "./image-plugin";
import { createSandboxAssets } from "./sandbox-assets";
import { createRef } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import {
  PlateComparisonEditor,
  type PlateComparisonEditorHandle,
  type PlateComparisonEditorLabels,
} from "./plate-editor";

const labels: PlateComparisonEditorLabels = {
  editor: "Comparison editor",
  toolbar: "Formatting",
  bold: "Bold",
  italic: "Italic",
  underline: "Underline",
  strikethrough: "Strikethrough",
  code: "Code",
  paragraph: "Paragraph",
  heading1: "Heading 1",
  heading2: "Heading 2",
  blockquote: "Quote",
  undo: "Undo",
  redo: "Redo",
};
afterEach(cleanup);

it("mounts an editable Plate instance and exports the latest imported document", async () => {
  const ref = createRef<PlateComparisonEditorHandle>();
  render(
    <SandboxAssetsProvider assets={createSandboxAssets()}>
      <PlateComparisonEditor ref={ref} initialValue="<h1>Initial</h1>" labels={labels} />
    </SandboxAssetsProvider>
  );
  expect(screen.getByRole("textbox", { name: labels.editor }).getAttribute("contenteditable")).toBe("true");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Initial");
  expect(await ref.current!.getHtml()).toContain("Initial");
  await act(async () => ref.current!.setHtml("<h2>Imported</h2><p><strong>Latest</strong></p>"));
  expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Imported");
  const html = await ref.current!.getHtml();
  expect(html).toContain("Latest");
  expect(html).not.toContain("Initial");
  expect(screen.getByRole("button", { name: labels.undo }).hasAttribute("disabled")).toBe(true);
  await act(async () => ref.current!.setMarkdown("## Markdown title\n\n**bold text**"));
  expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Markdown title");
  expect(await ref.current!.getHtml()).toContain("<strong");
});

it("renders official code syntax decorations without changing code text", () => {
  const { container } = render(
    <SandboxAssetsProvider assets={createSandboxAssets()}>
      <PlateComparisonEditor
        initialValue={'<pre><code class="language-javascript">const ready = true;</code></pre>'}
        labels={labels}
      />
    </SandboxAssetsProvider>
  );
  expect(container.querySelector("pre .hljs-keyword")?.textContent).toBe("const");
  expect(container.querySelector("pre .hljs-literal")?.textContent).toBe("true");
  expect(container.querySelector("pre code")?.textContent).toBe("const ready = true;");
  expect(container.querySelector("pre button, pre [role=combobox]")).toBeNull();
});

it("preserves the editor selection on toolbar mouse down", () => {
  render(
    <SandboxAssetsProvider assets={createSandboxAssets()}>
      <PlateComparisonEditor initialValue="<p>Text</p>" labels={labels} />
    </SandboxAssetsProvider>
  );
  expect(fireEvent.mouseDown(screen.getByRole("button", { name: labels.bold }))).toBe(false);
});
