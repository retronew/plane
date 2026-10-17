import { AttachOutline } from "@makeplane/propel/icons";
import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { sanitizeHTML } from "@plane/utils";
import { useMember } from "@/hooks/store/use-member";
import { useProjectState } from "@/hooks/store/use-project-state";

function getHistoryStateId(value: string) {
  try {
    const parsed = JSON.parse(value) as { state_id?: string } | null;
    return parsed?.state_id || value;
  } catch {
    return value;
  }
}

function getHistoryAttachmentName(value: string) {
  return (
    value
      .split("/")
      .at(-1)
      ?.replace(/^[a-f0-9]{32}-/, "") || value
  );
}

export const IntakeHistoryValue = observer(function IntakeHistoryValue({
  field,
  value,
}: {
  field: string | null | undefined;
  value: string | null | undefined;
}) {
  const { getUserDetails } = useMember();
  const { getStateById } = useProjectState();
  const { t } = useTranslation();
  let label = value || t("none");
  if (value && field === "assignees") label = getUserDetails(value)?.display_name || value;
  if (value && field === "state") label = getStateById(getHistoryStateId(value))?.name || value;
  if (value && field === "attachment") label = getHistoryAttachmentName(value);
  if (value && field === "description") label = sanitizeHTML(value) || t("none");
  return (
    <span className="inline-flex max-w-[45%] min-w-0 items-center gap-1" title={label}>
      {field === "attachment" && <AttachOutline className="size-3.5 shrink-0" aria-hidden />}
      <span className="truncate">{label}</span>
    </span>
  );
});
