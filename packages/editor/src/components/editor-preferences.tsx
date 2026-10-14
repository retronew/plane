import { createContext, useContext } from "react";

export type EditorPreferences = {
  smoothCursor: boolean;
  commentSubmitShortcut: "enter" | "mod-enter";
};

export const EditorPreferencesContext = createContext<EditorPreferences>({
  smoothCursor: false,
  commentSubmitShortcut: "enter",
});
export const useEditorPreferences = () => useContext(EditorPreferencesContext);
