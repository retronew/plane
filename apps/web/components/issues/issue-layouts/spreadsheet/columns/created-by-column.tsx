import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import type { TIssue } from "@plane/types";
import { ButtonAvatars } from "@/components/dropdowns/member/avatar";
import { useMember } from "@/hooks/store/use-member";

export const SpreadsheetCreatedByColumn = observer(function SpreadsheetCreatedByColumn({ issue }: { issue: TIssue }) {
  const { getUserDetails } = useMember();
  const { t } = useTranslation();
  const creator = issue.created_by ? getUserDetails(issue.created_by) : undefined;
  return (
    <div className="flex h-11 items-center gap-2 px-page-x text-13">
      {creator ? (
        <>
          <ButtonAvatars userIds={creator.id} showTooltip />
          <span className="max-w-48 truncate" title={creator.display_name}>
            {creator.display_name}
          </span>
        </>
      ) : (
        <span className="text-placeholder">{t("common.none")}</span>
      )}
    </div>
  );
});
