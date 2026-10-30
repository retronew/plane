import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { IEditorProps, TUserDetails } from "../types";
import type { comparisonCommandLabels } from "./plate-kit";

export type PlateCollaborationConfig = {
  url: string;
  name: string;
  token: string;
  user: TUserDetails;
  onProvider?: (provider: HocuspocusProvider | null) => void;
  onStatusChange?: (status: "connecting" | "synced" | "disconnected" | "error") => void;
  onUsersChange?: (users: import("../types").TCollaborationUser[]) => void;
  onStateless?: (payload: string) => void;
};
export type PlateEditorProps = Omit<IEditorProps, "editorProps" | "extensions"> & {
  aiHandler?: import("../types").TAIHandler;
  documentValue?: unknown;
  mode?: "rich" | "lite" | "document";
  toolbar?: "none" | "floating" | "fixed";
  dragDropEnabled?: boolean;
  useCommentSubmitShortcut?: boolean;
  collaboration?: PlateCollaborationConfig;
};
export type PlateComparisonEditorLabels = Partial<Record<keyof typeof comparisonCommandLabels, string>> & {
  editor: string;
  toolbar: string;
  bold: string;
  italic: string;
  underline: string;
  strikethrough: string;
  code: string;
  paragraph: string;
  heading1: string;
  heading2: string;
  blockquote: string;
  undo: string;
  redo: string;
};
