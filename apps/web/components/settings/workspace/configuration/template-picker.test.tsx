import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { TemplatePicker } from "./template-picker";
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("swr", () => ({
  default: () => ({
    data: [
      { id: "work", kind: "work_item", name: "Bug", title: "Bug report", description_html: "<p>Steps</p>" },
      { id: "page", kind: "page", name: "Plan", title: "Plan", description_html: "<p>Goals</p>" },
    ],
  }),
}));
vi.mock("./select", () => ({
  ConfigurationSelect: ({
    options,
    onChange,
    value,
  }: {
    options: { value: string; label: string }[];
    onChange: (v: string) => void;
    value: string;
  }) => (
    <select aria-label="templates" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choose template</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));
it("only offers the requested kind and applies explicitly without silently replacing form data", () => {
  const apply = vi.fn();
  render(<TemplatePicker workspaceSlug="test" kind="work_item" onApply={apply} />);
  expect(screen.queryByRole("option", { name: "Plan" })).toBeNull();
  fireEvent.change(screen.getByLabelText("templates"), { target: { value: "work" } });
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "web.apply_template" }));
  expect(apply).toHaveBeenCalledWith(
    expect.objectContaining({ title: "Bug report", description_html: "<p>Steps</p>" })
  );
});
