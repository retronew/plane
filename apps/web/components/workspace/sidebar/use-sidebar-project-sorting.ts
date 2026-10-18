import { useRef, useState } from "react";
import type { SortableChange } from "@plane/blocks/sortable";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import { useProject } from "@/hooks/store/use-project";
import { getSidebarProjectSortOrder } from "./project-sort-order";

export function useSidebarProjectSorting(workspaceSlug: string, visibleIds: string[], list: "main" | "extended") {
  const { joinedProjectIds, getPartialProjectById, updateProjectView } = useProject();
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const saving = useRef(false);
  const group = `sidebar-projects:${workspaceSlug}:${list}`;
  const onSortEnd = async (change: SortableChange) => {
    if (saving.current) throw new Error("Project order is being saved");
    const projects = joinedProjectIds.flatMap((id) => {
      const project = getPartialProjectById(id);
      return project ? [{ id, sort_order: project.sort_order }] : [];
    });
    const sortOrder = getSidebarProjectSortOrder(change, visibleIds, projects, group);
    if (sortOrder === undefined) return;
    saving.current = true;
    setIsSaving(true);
    try {
      await updateProjectView(workspaceSlug, change.id, { sort_order: sortOrder });
    } catch (error) {
      setToast({ type: "error", title: t("error"), message: t("something_went_wrong") });
      throw error;
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };
  return { group, isSaving, onSortEnd };
}
