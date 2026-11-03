import { useMemo, useState } from "react";
import { observer } from "mobx-react";
import { E_SORT_ORDER, defaultActivityFilters } from "@plane/constants";
import { useLocalStorage } from "@plane/hooks";
import { useTranslation } from "@plane/i18n";
import type { TFileSignedURLResponse, TIssueComment } from "@plane/types";
import { CommentCreate } from "@/components/comments/comment-create";
import { useProject } from "@/hooks/store/use-project";
import { IntakeActivityTabs } from "./intake-tabs";
import type { TIntakeActivityTab } from "./intake-tabs";
import { IssueActivityCommentRoot } from "./activity-comment-root";
import { useWorkItemCommentOperations } from "./helper";
import { ActivitySortRoot } from "./sort-root";

type TIssueActivity = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled?: boolean;
  isIntakeIssue?: boolean;
  variant?: "default" | "tabs";
};

export type TActivityOperations = {
  createComment: (data: Partial<TIssueComment>) => Promise<TIssueComment>;
  updateComment: (commentId: string, data: Partial<TIssueComment>) => Promise<void>;
  removeComment: (commentId: string) => Promise<void>;
  uploadCommentAsset: (blockId: string, file: File, commentId?: string) => Promise<TFileSignedURLResponse>;
};

function getComposerPlacement(disabled: boolean, showTabs: boolean, tab: TIntakeActivityTab, sortOrder: E_SORT_ORDER) {
  return {
    visible: !disabled && (!showTabs || tab === "all" || tab === "comments"),
    before: !showTabs && sortOrder === E_SORT_ORDER.DESC,
  };
}

export const IssueActivity = observer(function IssueActivity(props: TIssueActivity) {
  const { workspaceSlug, projectId, issueId, disabled = false, isIntakeIssue = false, variant = "tabs" } = props;
  const { t } = useTranslation();
  const showTabs = isIntakeIssue || variant === "tabs";
  const [intakeTab, setIntakeTab] = useState<TIntakeActivityTab>("all");
  const { setValue: setSortOrder, storedValue: sortOrder } = useLocalStorage(
    isIntakeIssue ? "intake_activity_sort_order" : "activity_sort_order",
    isIntakeIssue ? E_SORT_ORDER.DESC : E_SORT_ORDER.ASC
  );
  const { getProjectById } = useProject();
  const activityOperations = useWorkItemCommentOperations(workspaceSlug, projectId, issueId);
  const project = getProjectById(projectId);
  const effectiveSortOrder = sortOrder ?? (isIntakeIssue ? E_SORT_ORDER.DESC : E_SORT_ORDER.ASC);
  const { visible: showCommentCreation, before: composerBeforeActivities } = getComposerPlacement(
    disabled,
    showTabs,
    intakeTab,
    effectiveSortOrder
  );
  const composer = useMemo(
    () => (
      <CommentCreate
        workspaceSlug={workspaceSlug}
        entityId={issueId}
        activityOperations={activityOperations}
        showToolbarInitially
        variant="compact"
        isIntakeIssue={isIntakeIssue}
        projectId={projectId}
      />
    ),
    [workspaceSlug, issueId, activityOperations, projectId, isIntakeIssue]
  );
  if (!project) return null;

  return (
    <section data-issue-activity="" className="space-y-4">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0 flex-1 overflow-x-auto">
          {showTabs ? (
            <IntakeActivityTabs value={intakeTab} onChange={setIntakeTab} />
          ) : (
            <h2 className="text-h6-semibold text-secondary">{t("common.activity")}</h2>
          )}
        </div>
        <div className="ml-auto shrink-0">
          <ActivitySortRoot
            sortOrder={effectiveSortOrder}
            toggleSort={() =>
              setSortOrder(effectiveSortOrder === E_SORT_ORDER.ASC ? E_SORT_ORDER.DESC : E_SORT_ORDER.ASC)
            }
          />
        </div>
      </div>
      <div className="space-y-3">
        {showCommentCreation && composerBeforeActivities && composer}
        <IssueActivityCommentRoot
          projectId={projectId}
          workspaceSlug={workspaceSlug}
          isIntakeIssue={isIntakeIssue}
          intakeTab={intakeTab}
          variant={variant}
          issueId={issueId}
          selectedFilters={defaultActivityFilters}
          activityOperations={activityOperations}
          showAccessSpecifier={!!project.anchor}
          disabled={disabled}
          sortOrder={effectiveSortOrder}
        />
        {showCommentCreation && !composerBeforeActivities && composer}
      </div>
    </section>
  );
});
