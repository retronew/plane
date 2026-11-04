import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@plane/blocks/dialog";
import { useTranslation } from "@plane/i18n";

/** Share the same confirmation across dropdown and drag-and-drop state changes. */
export function useApprovalTransitionConfirmation() {
  const { t } = useTranslation();
  const [target, setTarget] = useState<string | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);

  useEffect(
    () => () => {
      resolver.current?.(false);
    },
    []
  );

  const finish = (confirmed: boolean) => {
    resolver.current?.(confirmed);
    resolver.current = null;
    setTarget(null);
  };

  return {
    requestConfirmation: (stateName: string) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setTarget(stateName);
      }),
    confirmationDialog: (
      <ConfirmDialog
        isOpen={target !== null}
        variant="warning"
        title={t("web.workflow_ui.confirm_enter_approval")}
        content={t("web.workflow_ui.confirm_enter_approval_description", { state: target ?? "" })}
        handleClose={() => finish(false)}
        handleSubmit={() => finish(true)}
        isSubmitting={false}
        primaryButtonText={{ default: t("web.workflow_ui.confirm_enter_approval") }}
      />
    ),
  };
}
