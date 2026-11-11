import { ArrowNarrowRightOutline, CloseOutline } from "@makeplane/propel/icons";
import { Loader } from "@plane/blocks/skeleton";
import { useTranslation } from "@plane/i18n";
import { IssueDetailContentSkeleton } from "@/components/common/loaders/issue-detail-skeleton";
import { useProject } from "@/hooks/store/use-project";

export function IssuePeekOverviewLoader({
  removeRoutePeekId,
  hasParent = false,
  floating = false,
  projectId,
  showHeader = true,
}: {
  removeRoutePeekId: () => void;
  hasParent?: boolean;
  floating?: boolean;
  projectId?: string;
  showHeader?: boolean;
}) {
  const { t } = useTranslation();
  const { getProjectById } = useProject();
  const propertyCount = 10 + Number(!!getProjectById(projectId)?.estimate);
  return (
    <div data-issue-peek-loading="" aria-busy="true" className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      {showHeader && (
        <div className="flex h-[60px] shrink-0 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <button type="button" aria-label={t("common.close_peek_view")} onClick={removeRoutePeekId}>
              {floating ? (
                <CloseOutline className="size-4 text-tertiary" />
              ) : (
                <ArrowNarrowRightOutline className="size-4 text-tertiary" />
              )}
            </button>
            <Loader>
              <Loader.Item width="28px" height="28px" />
            </Loader>
          </div>
          <Loader className="flex items-center gap-2">
            <Loader.Item width="70px" height="28px" />
            <Loader.Item width="28px" height="28px" />
          </Loader>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-scroll pr-2.5">
        <div className="space-y-6 px-8 pt-2 pb-5">
          <IssueDetailContentSkeleton peek hasParent={hasParent} propertyCount={propertyCount} />
        </div>
      </div>
    </div>
  );
}
