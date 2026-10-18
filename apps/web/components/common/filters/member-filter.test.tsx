import type { ComponentType } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { observable, runInAction } from "mobx";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FilterCreatedBy as CommonCreatedBy } from "./created-by";
import { FilterCreatedBy as IssueCreatedBy } from "@/components/issues/issue-layouts/filters/header/filters/created-by";
import { FilterAssignees } from "@/components/issues/issue-layouts/filters/header/filters/assignee";
import { FilterLead as ModuleLead } from "@/components/modules/dropdowns/filters/lead";
import { FilterMembers as ModuleMembers } from "@/components/modules/dropdowns/filters/members";
import { FilterLead as ProjectLead } from "@/components/project/dropdowns/filters/lead";
import { FilterMembers as ProjectMembers } from "@/components/project/dropdowns/filters/members";

const stores = vi.hoisted(() => ({
  members: {} as Record<string, { id: string; display_name: string; avatar_url: string }>,
  user: { data: { id: "me" } },
}));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({ getUserDetails: (id: string) => stores.members[id] }),
}));
vi.mock("@/hooks/store/user", () => ({ useUser: () => stores.user }));
vi.mock("@plane/i18n", () => ({
  translate: (key: string, values?: { count: number }) => (values ? `${key}:${values.count}` : key),
}));
vi.mock("@plane/utils", () => ({ getFileURL: (url: string) => url }));
vi.mock("@makeplane/propel/components/avatar", () => ({
  Avatar: ({ alt }: { alt: string }) => <span data-testid="avatar">{alt}</span>,
}));
vi.mock("@/components/issues/issue-layouts/filters", () => ({
  FilterHeader: ({
    field,
    title,
    handleIsPreviewEnabled,
  }: {
    field: string;
    title: string;
    handleIsPreviewEnabled: () => void;
  }) => (
    <button data-field={field} onClick={handleIsPreviewEnabled}>
      {title}
    </button>
  ),
  FilterOption: ({ title, isChecked, onClick }: { title: string; isChecked: boolean; onClick: () => void }) => (
    <button data-option="true" aria-pressed={isChecked} onClick={onClick}>
      {title}
    </button>
  ),
}));

type Props = {
  appliedFilters: string[] | null;
  handleUpdate: (id: string) => void;
  memberIds: string[] | undefined;
  searchQuery: string;
};
const cases: [string, ComponentType<Props>, string, string][] = [
  ["common creator", CommonCreatedBy, "created_by", "filter_created_by"],
  ["issue creator", IssueCreatedBy, "created_by", "filter_created_by"],
  ["issue assignee", FilterAssignees, "assignee", "filter_assignee"],
  ["module lead", ModuleLead, "lead", "filter_lead"],
  ["module members", ModuleMembers, "members", "filter_members"],
  ["project lead", ProjectLead, "lead", "filter_lead"],
  ["project members", ProjectMembers, "members", "filter_members"],
];
const names = () => Array.from(document.querySelectorAll("[data-option]"), (node) => node.textContent);
const mutate = (update: () => void) => act(() => runInAction(update));
beforeEach(() => {
  stores.members = observable(
    Object.fromEntries(
      ["Alice", "Bob", "Carol", "Dave", "Eve", "Frank", "Zoe"].map((name, index) => {
        const id = index === 6 ? "me" : String(index);
        return [id, { id, display_name: name, avatar_url: "" }];
      })
    )
  );
  stores.user = observable({ data: { id: "me" } });
});

describe.each(cases)("%s", (_name, Filter, field, title) => {
  it("updates after asynchronous IDs and member details arrive without changing search", () => {
    const props: Props = { appliedFilters: [], handleUpdate: vi.fn(), memberIds: undefined, searchQuery: "" };
    const { rerender } = render(<Filter {...props} />);
    const ids = observable.array<string>([]);
    rerender(<Filter {...props} memberIds={ids} />);
    mutate(() => ids.push("late"));
    expect(names()).toEqual([]);
    mutate(() => {
      stores.members.late = { id: "late", display_name: "Later", avatar_url: "" };
    });
    expect(names()).toEqual(["Later"]);
    mutate(() => ids.push("0"));
    expect(names()).toEqual(["Alice", "Later"]);
  });

  it("reacts to in-place selection changes and keeps selected, self, alphabetical order", () => {
    const selected = observable.array<string>([]);
    render(<Filter appliedFilters={selected} handleUpdate={vi.fn()} memberIds={["1", "0", "me"]} searchQuery="" />);
    expect(names()).toEqual(["web.you", "Alice", "Bob"]);
    mutate(() => selected.push("1"));
    expect(names()).toEqual(["Bob", "web.you", "Alice"]);
    expect(screen.getByRole("button", { name: "Bob" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(`web.runtime.${title}:1`).getAttribute("data-field")).toBe(field);
    mutate(() => selected.splice(0));
    expect(names()).toEqual(["web.you", "Alice", "Bob"]);
    mutate(() => {
      stores.user.data.id = "1";
    });
    expect(names()).toEqual(["web.you", "Alice", "Zoe"]);
  });

  it("searches case-insensitively, expands and collapses, and calls back with IDs", () => {
    const update = vi.fn();
    const props: Props = {
      appliedFilters: null,
      handleUpdate: update,
      memberIds: ["5", "4", "3", "2", "1", "0", "me"],
      searchQuery: "",
    };
    const { rerender } = render(<Filter {...props} />);
    expect(names()).toEqual(["web.you", "Alice", "Bob", "Carol", "Dave"]);
    fireEvent.click(screen.getByText("web.view_all"));
    expect(names()).toHaveLength(7);
    fireEvent.click(screen.getByText("web.view_less"));
    expect(names()).toHaveLength(5);
    fireEvent.click(screen.getByText(`web.runtime.${title}:0`));
    expect(names()).toEqual([]);
    fireEvent.click(screen.getByText(`web.runtime.${title}:0`));
    fireEvent.click(screen.getByRole("button", { name: "Alice" }));
    expect(update).toHaveBeenCalledWith("0");
    rerender(<Filter {...props} searchQuery="bOB" />);
    expect(names()).toEqual(["Bob"]);
    rerender(<Filter {...props} searchQuery="missing" />);
    expect(screen.getByText("web.no_matches_found")).toBeTruthy();
  });
});
