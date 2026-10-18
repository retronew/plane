import { useState } from "react";
import {
  CloseOutline,
  DeleteOutline,
  EditOutline,
  MoreHorizontalOutline,
  PauseOutline,
  PlayOutline,
  TickOutline,
  WorkflowsOutline,
} from "@makeplane/propel/icons";
import { Button } from "@makeplane/propel/components/button";
import {
  Dialog,
  DialogContent,
  DialogMain,
  DialogHeader,
  DialogHeading,
  DialogTitle,
  DialogCloseGroup,
  DialogBody,
  DialogActions,
} from "@makeplane/propel/components/dialog";
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Menu, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { ActionMenuContent } from "@plane/blocks/common";
import { useTranslation } from "@plane/i18n";
import type { TProjectIssueType, TProjectWorkflow, TWorkflowImpactRequest } from "@plane/types";
const key = "web.workflow_ui.types_settings";
const noWorkflows: TProjectWorkflow[] = [];
export function TypesActions({
  type,
  canManage,
  workflows = noWorkflows,
  busy,
  onEdit,
  onSave,
  onPreview,
}: {
  type: TProjectIssueType;
  canManage: boolean;
  workflows?: TProjectWorkflow[];
  busy: boolean;
  onEdit: (type: TProjectIssueType) => void;
  onSave: (data: Partial<TProjectIssueType>, id: string) => Promise<TProjectIssueType | false>;
  onPreview: (request: TWorkflowImpactRequest) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [bindingOpen, setBindingOpen] = useState(false);
  const [workflowId, setWorkflowId] = useState(type.workflow_id ?? "");
  const currentWorkflowId = type.workflow_id ?? "";
  const workflowItems = [
    { value: "", label: t("web.workflow_ui.default_name") },
    ...workflows
      .filter((item) => !item.is_default)
      .map((item) => ({
        value: item.workflow_id ?? item.id,
        label: item.name ?? "",
      })),
  ];
  const previewBinding = async () => {
    if (busy || workflowId === currentWorkflowId) return;
    await onPreview({ operation: "bind_type", type_id: type.id, workflow_id: workflowId || undefined });
    setBindingOpen(false);
  };
  return (
    canManage && (
      <>
        <Menu>
          <MenuTrigger
            render={
              <IconButton
                variant="ghost"
                size="md"
                icon={<MoreHorizontalOutline className="size-4" />}
                aria-label={`${t("aria_labels.common.more_actions")} ${type.name}`}
              />
            }
          />
          <ActionMenuContent side="bottom" align="end">
            <MenuItem
              disabled={busy}
              icon={<EditOutline className="size-4" />}
              label={t("edit")}
              onClick={() => onEdit(type)}
            />
            <MenuItem
              disabled={busy}
              label={t("common.workflows")}
              icon={<WorkflowsOutline className="size-4" />}
              onClick={() => {
                setWorkflowId(currentWorkflowId);
                setBindingOpen(true);
              }}
            />
            {!type.is_default && (
              <>
                <MenuItem
                  disabled={busy || !type.is_active}
                  icon={<TickOutline className="size-4" />}
                  label={t(`${key}.set_default`)}
                  onClick={() => void onSave({ is_default: true }, type.id)}
                />
                <MenuItem
                  disabled={busy}
                  icon={type.is_active ? <PauseOutline className="size-4" /> : <PlayOutline className="size-4" />}
                  label={t(type.is_active ? "web.workflow_ui.disable" : "web.workflow_ui.enable_one")}
                  onClick={() => void onSave({ is_active: !type.is_active }, type.id)}
                />
              </>
            )}
            <hr className="my-1 border-subtle" />
            <MenuItem
              disabled={busy || type.is_default}
              variant="danger"
              icon={<DeleteOutline className="size-4" />}
              label={t("delete")}
              onClick={() => void onPreview({ operation: "remove_type", type_id: type.id })}
            />
            {type.is_default && (
              <p className="max-w-60 px-3 py-2 text-caption-md-regular text-secondary">
                {t(`${key}.default_delete_hint`)}
              </p>
            )}
          </ActionMenuContent>
        </Menu>
        <Dialog
          open={bindingOpen}
          onOpenChange={(next) => {
            if (!busy) setBindingOpen(next);
          }}
        >
          <DialogContent size="md">
            <DialogMain>
              <DialogHeader>
                <DialogHeading>
                  <DialogTitle>{t("common.workflows")}</DialogTitle>
                </DialogHeading>
                <DialogCloseGroup>
                  <IconButton
                    size="md"
                    variant="ghost"
                    icon={<CloseOutline />}
                    aria-label={t("close")}
                    disabled={busy}
                    onClick={() => setBindingOpen(false)}
                  />
                </DialogCloseGroup>
              </DialogHeader>
              <DialogBody>
                <form
                  id={`type-workflow-${type.id}`}
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void previewBinding();
                  }}
                >
                  <label className="block space-y-2 text-body-xs-regular text-secondary">
                    <span>{t("common.workflows")}</span>
                    <Select
                      items={workflowItems}
                      value={workflowId}
                      disabled={busy}
                      onValueChange={(value) => {
                        if (value !== null) setWorkflowId(value);
                      }}
                    >
                      <SelectTrigger size="lg" variant="secondary" aria-label={t("common.workflows")} />
                      <SelectContent>
                        <SelectList>
                          {workflowItems.map((item) => (
                            <SelectItem key={item.value} value={item.value} label={item.label} />
                          ))}
                        </SelectList>
                      </SelectContent>
                    </Select>
                  </label>
                  <p className="text-body-xs-regular text-secondary">{t("web.workflow_ui.impact_warning")}</p>
                </form>
              </DialogBody>
              <DialogActions>
                <Button
                  stretch="auto"
                  variant="secondary"
                  size="md"
                  label={t("cancel")}
                  disabled={busy}
                  onClick={() => setBindingOpen(false)}
                />
                <Button
                  stretch="auto"
                  variant="primary"
                  size="md"
                  type="submit"
                  form={`type-workflow-${type.id}`}
                  label={t("web.workflow_ui.impact_title")}
                  disabled={busy || workflowId === currentWorkflowId}
                />
              </DialogActions>
            </DialogMain>
          </DialogContent>
        </Dialog>
      </>
    )
  );
}
