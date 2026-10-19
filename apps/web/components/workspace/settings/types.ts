import { EUserPermissions } from "@plane/constants";
import type { IWorkspaceMember } from "@plane/types";

export interface RowData {
  member: IWorkspaceMember;
  role: EUserPermissions;
  is_active: boolean;
}
