// oxlint-disable import/no-unassigned-import -- shared composer layout and motion styles
import "@/components/issues/issue-modal/composer.css";
import { useCallback, useRef, useState } from "react";
import { observer } from "mobx-react";
import { Dialog, DialogContent } from "@makeplane/propel/components/dialog";
import { getDialogInitialFocusProps } from "@/helpers/dialog";
import { useUser } from "@/hooks/store/user";
import { composerCacheKey, readComposerDraft } from "@/components/issues/issue-modal/composer-cache";
import {
  prepareComposerMotion,
  COMPOSER_RESTORE_DURATION,
  COMPOSER_MOTION_EASING,
} from "@/components/issues/issue-modal/composer-motion";
import { InboxIssueCreateRoot } from "./create-root";

type TInboxIssueCreateModalRoot = {
  workspaceSlug: string;
  projectId: string;
  modalState: boolean;
  handleModalClose: () => void;
};

export const InboxIssueCreateModalRoot = observer(function InboxIssueCreateModalRoot(
  props: TInboxIssueCreateModalRoot
) {
  const { workspaceSlug, projectId, modalState, handleModalClose } = props;
  const { data: user } = useUser();
  const cacheKey = user?.id ? composerCacheKey(user.id, workspaceSlug, `intake:${projectId}`) : undefined;
  const triggerSelector = `[data-intake-request-trigger="${projectId}"]`;
  const closeRequestRef = useRef<(() => void) | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const animatedPopups = useRef(new WeakSet<HTMLDivElement>());
  const [opening, setOpening] = useState({ open: modalState, generation: 0 });
  if (opening.open !== modalState) {
    setOpening({ open: modalState, generation: opening.generation + (modalState ? 1 : 0) });
  }
  const composerRef = useCallback(
    (popup: HTMLDivElement | null) => {
      popupRef.current = popup;
      if (!popup || animatedPopups.current.has(popup)) return;
      animatedPopups.current.add(popup);
      if (!cacheKey || !readComposerDraft(cacheKey)) return;
      const travel = prepareComposerMotion(popup, "new", triggerSelector);
      if (travel)
        popup.animate(
          [
            { translate: travel, scale: "0.2", opacity: 0 },
            { translate: "0px 0px", scale: "1", opacity: 1 },
          ],
          { duration: COMPOSER_RESTORE_DURATION, easing: COMPOSER_MOTION_EASING }
        );
    },
    [cacheKey, triggerSelector]
  );

  return (
    <Dialog
      open={modalState}
      onOpenChange={(open) => {
        if (!open) closeRequestRef.current?.();
      }}
    >
      <DialogContent
        ref={composerRef}
        size="lg"
        data-issue-composer=""
        data-intake-composer=""
        {...getDialogInitialFocusProps("[data-composer-title]")}
      >
        <InboxIssueCreateRoot
          key={`${cacheKey ?? projectId}:${opening.generation}`}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          handleModalClose={handleModalClose}
          closeRequestRef={closeRequestRef}
          cacheKey={cacheKey}
          popupRef={popupRef}
          triggerSelector={triggerSelector}
        />
      </DialogContent>
    </Dialog>
  );
});
