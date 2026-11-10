import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { TStateOperationsCallbacks } from "@plane/types";
import { GroupList } from "./group-list";
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/sortable", () => ({ SortableProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/project-states", () => ({
  GroupItem: ({
    groupKey,
    isEditable,
    allowNewWorkItems,
  }: {
    groupKey: string;
    isEditable: boolean;
    allowNewWorkItems: { onChange: (checked: boolean) => Promise<void> };
  }) => (
    <button disabled={!isEditable} onClick={() => void allowNewWorkItems.onChange(false).catch(() => undefined)}>
      {groupKey}
    </button>
  ),
}));
it.each([false, true])("serializes group toggles and unlocks after a request settles (failure: %s)", async (fail) => {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const pending = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const update = vi.fn().mockReturnValueOnce(pending).mockResolvedValue(undefined);
  render(
    <GroupList
      groupedStates={{ backlog: [], completed: [] }}
      isEditable
      stateOperationsCallbacks={{} as TStateOperationsCallbacks}
      disabledStateGroups={{ groups: [], onChange: update }}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "backlog" }));
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "completed" }).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "completed" }));
  expect(update).toHaveBeenCalledTimes(1);
  await act(async () => {
    if (fail) reject(new Error("rejected"));
    else resolve();
  });
  await waitFor(() =>
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "completed" }).disabled).toBe(false)
  );
  fireEvent.click(screen.getByRole("button", { name: "completed" }));
  expect(update).toHaveBeenLastCalledWith("completed", false);
  await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
});
