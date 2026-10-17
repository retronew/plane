import { useRef, useState } from "react";
import { observer } from "mobx-react";
import { setToast } from "@plane/blocks/toast";
import { translate } from "@plane/i18n";
import { LabelSelect } from "@/components/dropdowns/label/label-select";
import type { TPageInstance } from "@/store/pages/base-page";

export const PageLabels = observer(function PageLabels({ page }: { page: TPageInstance }) {
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const projectId = page.project_ids?.[0];

  const updateLabels = async (labelIds: string[]) => {
    if (!page.isContentEditable || savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    try {
      await page.update({ label_ids: labelIds });
    } catch (error) {
      console.error("Failed to update page labels", error);
      setToast({
        type: "error",
        title: translate("toast.error"),
        message: translate("web.some_error_occurred_please_try_again"),
      });
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  if (!projectId) return null;

  return (
    <div role="presentation" onClick={(event) => event.stopPropagation()}>
      <LabelSelect
        projectId={projectId}
        value={page.label_ids ?? []}
        onChange={updateLabels}
        variant={page.label_ids?.length ? "pill-sm" : "icon-sm"}
        disabled={!page.isContentEditable || isSaving}
        className={page.label_ids?.length ? "max-w-40" : "size-6 rounded-md [&_svg]:size-4"}
        testId="page-labels"
        tooltip
      />
    </div>
  );
});
