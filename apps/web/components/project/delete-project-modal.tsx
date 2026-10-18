/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Translation } from "@plane/i18n";
import { useParams } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
// Plane imports
import { Field } from "@makeplane/propel/components/field";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { Button } from "@makeplane/propel/components/button";
import { setToast } from "@plane/blocks/toast";
import type { IProject } from "@plane/types";
import { Dialog, DialogActions, DialogBody, DialogContent, DialogMain } from "@makeplane/propel/components/dialog";
// components
import { DangerDialogHeader } from "@/components/common/danger-dialog-header";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useAppRouter } from "@/hooks/use-app-router";
import { translate } from "@plane/i18n";

type DeleteProjectModal = {
  isOpen: boolean;
  project: IProject;
  onClose: () => void;
};

const defaultValues = {
  projectName: "",
  confirmDelete: "",
};

export function DeleteProjectModal(props: DeleteProjectModal) {
  const { isOpen, project, onClose } = props;
  // store hooks
  const { deleteProject } = useProject();
  // router
  const router = useAppRouter();
  const { workspaceSlug, projectId } = useParams();
  // form info
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    reset,
  } = useForm({ defaultValues });

  const [projectName, confirmDelete] = useWatch({ control, name: ["projectName", "confirmDelete"] });
  const canDelete = projectName === project?.name && confirmDelete === "delete my project";

  const handleClose = () => {
    const timer = setTimeout(() => {
      reset(defaultValues);
      clearTimeout(timer);
    }, 350);

    onClose();
  };

  const onSubmit = async () => {
    if (!workspaceSlug || !canDelete) return;

    try {
      await deleteProject(workspaceSlug.toString(), project.id);
      if (projectId && projectId.toString() === project.id) router.push(`/${workspaceSlug}/projects`);
      handleClose();
      setToast({
        type: "success",
        title: translate("toast.success"),
        message: translate("web.project_deleted_successfully"),
      });
    } catch (_error) {
      setToast({
        type: "error",
        title: translate("toast.error"),
        message: translate("web.something_went_wrong_please_try_again_later_05e0"),
      });
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <DialogMain>
            <DangerDialogHeader title={translate("web.delete_project")} />
            <DialogBody>
              <div className="flex flex-col gap-6">
                <p className="text-13 leading-7 text-secondary">
                  {translate("web.delete_project_confirm_prefix")}{" "}
                  <span className="font-semibold break-words">{project?.name}</span>
                  {translate("web.delete_project_confirm_suffix")}
                </p>
                <div className="flex flex-col gap-2 text-secondary">
                  <label htmlFor="projectName" className="text-13 break-words">
                    <Translation
                      translationKey="web.ui.confirm_project_name"
                      components={{ name: <span className="font-medium text-primary">{project?.name}</span> }}
                    />
                  </label>
                  <Controller
                    control={control}
                    name="projectName"
                    render={({ field: { value, onChange, ref } }) => (
                      <Field name="projectName" invalid={Boolean(errors.projectName)}>
                        <InputGroup size="lg">
                          <Input
                            size="lg"
                            id="projectName"
                            name="projectName"
                            type="text"
                            value={value}
                            onChange={onChange}
                            ref={ref}
                            placeholder={translate("web.project_name")}
                            autoComplete="off"
                          />
                        </InputGroup>
                      </Field>
                    )}
                  />
                </div>
                <div className="flex flex-col gap-2 text-secondary">
                  <label htmlFor="confirmDelete" className="text-13">
                    <Translation
                      translationKey="web.ui.confirm_phrase"
                      components={{
                        phrase: (
                          <code className="font-mono rounded-md bg-danger-subtle/60 px-1 py-0.5 text-12 text-danger-primary">
                            delete my project
                          </code>
                        ),
                      }}
                    />
                  </label>
                  <Controller
                    control={control}
                    name="confirmDelete"
                    render={({ field: { value, onChange, ref } }) => (
                      <Field name="confirmDelete" invalid={Boolean(errors.confirmDelete)}>
                        <InputGroup size="lg">
                          <Input
                            size="lg"
                            id="confirmDelete"
                            name="confirmDelete"
                            type="text"
                            value={value}
                            onChange={onChange}
                            ref={ref}
                            placeholder={translate("web.enter_delete_my_project")}
                            autoComplete="off"
                          />
                        </InputGroup>
                      </Field>
                    )}
                  />
                </div>
              </div>
            </DialogBody>
          </DialogMain>
          <DialogActions>
            <Button
              variant="secondary"
              size="md"
              stretch="auto"
              label={translate("web.cancel")}
              onClick={handleClose}
            />
            <Button
              variant="danger"
              size="md"
              stretch="auto"
              type="submit"
              label={isSubmitting ? translate("web.deleting_2") : translate("web.delete_project")}
              disabled={!canDelete}
              loading={isSubmitting}
            />
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
