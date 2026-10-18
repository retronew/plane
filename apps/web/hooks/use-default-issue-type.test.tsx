import { renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { UseFormGetValues, UseFormSetValue } from "react-hook-form";
import type { TIssue, TProjectIssueType } from "@plane/types";
import { useDefaultIssueType } from "./use-default-issue-type";
const type: TProjectIssueType = {
  id: "bug",
  project_issue_type_id: "pt",
  name: "Bug",
  is_default: true,
  is_active: true,
  workflow_id: "custom",
};
it("writes the real default ID after types load asynchronously", () => {
  const setValue = vi.fn(),
    getValues = vi.fn(() => null) as unknown as UseFormGetValues<TIssue>,
    getDefault = () => null;
  const { rerender } = renderHook(
    ({ types }: { types?: TProjectIssueType[] }) =>
      useDefaultIssueType({
        projectId: "p",
        types,
        getValues,
        setValue: setValue as UseFormSetValue<TIssue>,
        getDefault,
      }),
    { initialProps: { types: undefined as TProjectIssueType[] | undefined } }
  );
  expect(setValue).not.toHaveBeenCalled();
  rerender({ types: [type] });
  expect(setValue).toHaveBeenCalledWith("type_id", "bug", { shouldValidate: true });
});
it("preserves a user selection when project types arrive", () => {
  const setValue = vi.fn();
  const { rerender } = renderHook(
    ({ types }: { types?: TProjectIssueType[] }) =>
      useDefaultIssueType({
        projectId: "p",
        types,
        getValues: (() => "selected") as unknown as UseFormGetValues<TIssue>,
        setValue: setValue as UseFormSetValue<TIssue>,
        getDefault: () => null,
      }),
    { initialProps: { types: undefined as TProjectIssueType[] | undefined } }
  );
  rerender({ types: [type] });
  expect(setValue).not.toHaveBeenCalled();
});
it.each([{ id: "existing", type_id: null }, { type_id: null }])(
  "preserves explicit null and existing item type",
  (data) => {
    const setValue = vi.fn();
    renderHook(() =>
      useDefaultIssueType({
        projectId: "p",
        types: [type],
        data,
        getValues: (() => null) as unknown as UseFormGetValues<TIssue>,
        setValue: setValue as UseFormSetValue<TIssue>,
        getDefault: () => null,
      })
    );
    expect(setValue).not.toHaveBeenCalled();
  }
);
