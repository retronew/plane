import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScriptEditor } from "./script-editor";

function EditableScript({ initialValue = "" }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return <ScriptEditor aria-label="Script" language="javascript" value={value} onChange={setValue} />;
}

describe("script editor", () => {
  it("keeps a real editable textarea, blank lines, tabs, and escaped source intact", async () => {
    const { container } = render(<EditableScript />);
    const input = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Script" });
    const source = '// <script>alert("draft")</script>\n\n\treturn "你好";\n\n';
    fireEvent.change(input, { target: { value: source } });
    expect(input.value).toBe(source);
    expect(input.wrap).toBe("off");
    expect(input.getAttribute("spellcheck")).toBe("false");
    await waitFor(() => expect(container.querySelector("[style*='--script-token-light']")).toBeTruthy());
    const codeLines = container.querySelectorAll("code > span");
    expect(codeLines).toHaveLength(5);
    expect(Array.from(codeLines, (line) => line.textContent).join("\n")).toBe(source);
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[aria-hidden='true']")?.textContent).toBe("12345");
    const token = container.querySelector("[style*='--script-token-light']");
    expect(token?.getAttribute("style")).toContain("--script-token-dark");
    expect(token?.className).toContain("dark:text-");
  });

  it("scrolls the highlight in both axes and keeps the line numbers fixed horizontally", () => {
    const source = Array.from({ length: 80 }, (_, index) => `const line${index} = '${"x".repeat(200)}';`).join("\n");
    const { container } = render(<EditableScript initialValue={source} />);
    const input = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Script" });
    fireEvent.scroll(input, { target: { scrollTop: 240, scrollLeft: 120 } });
    expect(container.querySelector("pre")?.style.transform).toBe("translate(-120px, -240px)");
    expect(container.querySelector<HTMLElement>("[aria-hidden='true'] > div")?.style.transform).toBe(
      "translateY(-240px)"
    );
    fireEvent.scroll(input, { target: { scrollTop: 0, scrollLeft: 0 } });
    expect(container.querySelector("pre")?.style.transform).toBe("translate(0px, 0px)");
  });

  it("retokenizes an external source and language change without modifying the value", async () => {
    const { container, rerender } = render(
      <ScriptEditor aria-label="Script" language="javascript" value="const x = 1;" onChange={() => {}} />
    );
    await waitFor(() => expect(container.querySelector("[style*='--script-token-light']")).toBeTruthy());
    const source = 'def greet():\n    return "hello"\n';
    rerender(<ScriptEditor aria-label="Script" language="python" value={source} onChange={() => {}} disabled />);
    const input = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Script" });
    expect(input.value).toBe(source);
    expect(input.disabled).toBe(true);
    expect(container.querySelector("code")?.textContent).toContain("def greet():");
    expect(container.querySelectorAll("code > span")).toHaveLength(3);
  });
});
