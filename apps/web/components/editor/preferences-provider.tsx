import { useMemo } from "react";
import type { ReactNode } from "react";
import { observer } from "mobx-react";
import { EditorPreferencesContext } from "@plane/editor";
import { useUserProfile } from "@/hooks/store/user";

export const EditorPreferencesProvider = observer(function EditorPreferencesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { data } = useUserProfile();
  const smoothCursor = data.is_smooth_cursor_enabled ?? false;
  const commentSubmitShortcut = data.comment_submit_shortcut ?? "enter";
  const value = useMemo(() => ({ smoothCursor, commentSubmitShortcut }), [smoothCursor, commentSubmitShortcut]);
  return <EditorPreferencesContext.Provider value={value}>{children}</EditorPreferencesContext.Provider>;
});
