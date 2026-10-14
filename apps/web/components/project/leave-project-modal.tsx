/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Translation } from "@plane/i18n";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { WarningTriangleOutline } from "@makeplane/propel/icons";
// Plane imports
import { Field } from "@makeplane/propel/components/field";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { Button } from "@makeplane/propel/components/button";
import { setToast } from "@plane/blocks/toast";
import type { IProject } from "@plane/types";
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
// hooks
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import { translate } from "@plane/i18n";

type FormData = {
  projectName: string;
  confirmLeave: string;
};

const defaultValues: FormData = {
  projectName: "",
  confirmLeave: "",
};

export interface ILeaveProjectModal {
  project: IProject;
  isOpen: boolean;
  onClose: () => void;
}

export const LeaveProjectModal = observer(function LeaveProjectModal(props: ILeaveProjectModal) {
  const { project, isOpen, onClose } = props;
  // router
  const router = useAppRouter();
  const { workspaceSlug } = useParams();
  // store hooks
  const { leaveProject } = useUserPermissions();

  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    reset,
  } = useForm({ defaultValues });

  const handleClose = () => {
    reset({ ...defaultValues });
    onClose();
  };

  const onSubmit = async (data: any) => {
    if (!workspaceSlug) return;

    if (data) {
      if (data.projectName === project?.name) {
        if (data.confirmLeave === "Leave Project") {
          router.push(`/${workspaceSlug}/projects`);
          return leaveProject(workspaceSlug.toString(), project.id)
            .then(() => {
              handleClose();
              return undefined;
            })
            .catch((_err) => {
              setToast({
                type: "error",
                title: translate("toast.error"),
                message: translate("web.something_went_wrong_please_try_again_later"),
              });
            });
        } else {
          setToast({
            type: "error",
            title: translate("toast.error"),
            message: translate("web.please_confirm_leaving_the_project_by_typing_the_leave_proje"),
          });
        }
      } else {
        setToast({
          type: "error",
          title: translate("toast.error"),
          message: translate("web.please_enter_the_project_name_as_shown_in_the_description"),
        });
      }
    } else {
      setToast({
        type: "error",
        title: translate("toast.error"),
        message: translate("web.please_fill_all_fields"),
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
            <DialogHeader>
              <div className="flex w-full items-center justify-start gap-6">
                <span className="place-items-center rounded-full bg-danger-subtle p-4">
                  <WarningTriangleOutline className="h-6 w-6 text-danger-primary" aria-hidden="true" />
                </span>
                <DialogHeading>
                  <DialogTitle>{translate("web.leave_project")}</DialogTitle>
                </DialogHeading>
              </div>
            </DialogHeader>
            <DialogBody>
              <div className="flex flex-col gap-6">
                <p className="text-13 leading-7 text-secondary">
                  {translate("web.leave_project_confirm_prefix")}
                  <span className="font-medium text-primary">{` "${project?.name}" `}</span>
                  {translate("web.leave_project_confirm_suffix")}
                </p>
                <div className="text-secondary">
                  <p className="text-13 break-words">
                    <Translation
                      translationKey="web.ui.confirm_project_name"
                      components={{ name: <span className="font-medium text-primary">{project?.name}</span> }}
                    />
                  </p>
                  <Controller
                    control={control}
                    name="projectName"
                    rules={{
                      required: translate("web.label_title_is_required"),
                    }}
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
                            placeholder={translate("web.enter_project_name")}
                          />
                        </InputGroup>
                      </Field>
                    )}
                  />
                </div>
                <div className="text-secondary">
                  <p className="text-13">
                    <Translation
                      translationKey="web.ui.confirm_phrase"
                      components={{
                        phrase: <span className="font-medium text-primary">{translate("web.leave_project")}</span>,
                      }}
                    />
                  </p>
                  <Controller
                    control={control}
                    name="confirmLeave"
                    render={({ field: { value, onChange, ref } }) => (
                      <Field name="confirmLeave" invalid={Boolean(errors.confirmLeave)}>
                        <InputGroup size="lg">
                          <Input
                            size="lg"
                            id="confirmLeave"
                            name="confirmLeave"
                            type="text"
                            value={value}
                            onChange={onChange}
                            ref={ref}
                            placeholder={translate("web.enter_leave_project")}
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
              label={isSubmitting ? translate("web.leaving") : translate("web.leave_project")}
              loading={isSubmitting}
            />
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
});
