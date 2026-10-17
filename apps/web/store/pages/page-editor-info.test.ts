import { expect, it, vi } from "vitest";
import type { EditorRefApi, TCollaborationUser } from "@plane/editor";
import { PageEditorInstance } from "./page-editor-info";

function editorRef(users: TCollaborationUser[]) {
  let callback: (users: TCollaborationUser[]) => void = () => {};
  const unsubscribe = vi.fn();
  const ref = {
    getCollaborationUsers: () => users,
    onCollaborationUsersChange: vi.fn((cb) => {
      callback = cb;
      return unsubscribe;
    }),
  } as unknown as EditorRefApi;
  return { ref, unsubscribe, emit: (value: TCollaborationUser[]) => callback(value) };
}
const ada = { id: "a", name: "Ada", avatar: null };
it("replaces subscriptions, ignores stale callbacks, and clears on unmount", () => {
  const store = new PageEditorInstance();
  const a = editorRef([ada]);
  const b = editorRef([]);
  store.setEditorRef(a.ref);
  expect(store.collaborationUsers).toEqual([ada]);
  const snapshot = store.collaborationUsers;
  a.emit([{ ...ada }]);
  expect(store.collaborationUsers).toBe(snapshot);
  store.setEditorRef(a.ref);
  expect(a.ref.onCollaborationUsersChange).toHaveBeenCalledTimes(1);
  store.setEditorRef(b.ref);
  expect(a.unsubscribe).toHaveBeenCalledOnce();
  expect(store.collaborationUsers).toEqual([]);
  a.emit([ada]);
  expect(store.collaborationUsers).toEqual([]);
  b.emit([ada]);
  expect(store.collaborationUsers).toEqual([ada]);
  store.setEditorRef(null);
  expect(b.unsubscribe).toHaveBeenCalledOnce();
  expect(store.collaborationUsers).toEqual([]);
  b.emit([ada]);
  expect(store.collaborationUsers).toEqual([]);
});
