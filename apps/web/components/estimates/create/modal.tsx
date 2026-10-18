/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { useLayoutEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { EEstimateSystem, ESTIMATE_SYSTEMS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { setToast } from "@plane/blocks/toast";
import type { IEstimateFormData, TEstimateSystemKeys } from "@plane/types";
import { useProjectEstimates } from "@/hooks/store/estimates";
import { EstimateCreateStageOne } from "./stage-one";

type Props = { workspaceSlug: string; projectId: string; isOpen: boolean; handleClose: () => void };

export const CreateEstimateModal = observer(function CreateEstimateModal({
  workspaceSlug,
  projectId,
  isOpen,
  handleClose,
}: Props) {
  const { createEstimate } = useProjectEstimates();
  const { t } = useTranslation();
  const [estimateSystem, setEstimateSystem] = useState<TEstimateSystemKeys>(EEstimateSystem.POINTS);
  const [templateKey, setTemplateKey] = useState("fibonacci");
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const identity = `${workspaceSlug}/${projectId}`;
  const [session, setSession] = useState({ identity, isOpen, generation: 0 });
  if (session.identity !== identity || session.isOpen !== isOpen) {
    setSession({ identity, isOpen, generation: session.generation + 1 });
    if (isOpen) {
      setEstimateSystem(EEstimateSystem.POINTS);
      setTemplateKey("fibonacci");
      setSaving(false);
    }
  }
  const currentSession = useRef(session);
  useLayoutEffect(() => {
    currentSession.current = session;
    inFlight.current = false;
    return () => {
      currentSession.current = { ...session, isOpen: false };
    };
  }, [session]);
  const handleCreate = async () => {
    const template = ESTIMATE_SYSTEMS[estimateSystem].templates[templateKey];
    if (inFlight.current || !workspaceSlug || !projectId || !template || template.hide) return;
    const requestSession = currentSession.current;
    inFlight.current = true;
    setSaving(true);
    try {
      const payload: IEstimateFormData = {
        estimate: { name: ESTIMATE_SYSTEMS[estimateSystem].name, type: estimateSystem, last_used: true },
        estimate_points: template.values.map((point, index) => ({ id: point.id, key: index + 1, value: point.value })),
      };
      await createEstimate(workspaceSlug, projectId, payload);
      if (currentSession.current !== requestSession || !currentSession.current.isOpen) return;
      setToast({
        type: "success",
        title: t("project_settings.estimates.toasts.created.success.title"),
        message: t("project_settings.estimates.toasts.created.success.message"),
      });
      handleClose();
    } catch {
      if (currentSession.current !== requestSession || !currentSession.current.isOpen) return;
      setToast({
        type: "error",
        title: t("project_settings.estimates.toasts.created.error.title"),
        message: t("project_settings.estimates.toasts.created.error.message"),
      });
    } finally {
      if (currentSession.current === requestSession) {
        inFlight.current = false;
        setSaving(false);
      }
    }
  };
  return (
    <Dialog
      open={isOpen}
      disablePointerDismissal
      onOpenChange={(open, event) => {
        if (!open && !saving && event.reason !== "escape-key") handleClose();
      }}
    >
      <DialogContent size="md">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>{t("project_settings.estimates.new")}</DialogTitle>
            </DialogHeading>
          </DialogHeader>
          <DialogBody>
            <EstimateCreateStageOne
              estimateSystem={estimateSystem}
              templateKey={templateKey}
              disabled={saving}
              handleEstimateSystem={(system) => {
                setEstimateSystem(system);
                setTemplateKey(
                  Object.keys(ESTIMATE_SYSTEMS[system].templates).find(
                    (key) => !ESTIMATE_SYSTEMS[system].templates[key].hide
                  ) ?? ""
                );
              }}
              handleTemplateChange={setTemplateKey}
            />
          </DialogBody>
        </DialogMain>
        <DialogActions>
          <Button
            variant="secondary"
            size="md"
            stretch="auto"
            label={t("common.cancel")}
            onClick={handleClose}
            disabled={saving}
          />
          <Button
            variant="primary"
            size="md"
            stretch="auto"
            label={saving ? t("common.creating") : t("project_settings.estimates.create.label")}
            onClick={handleCreate}
            disabled={saving || !templateKey}
          />
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
});
