import { Check, MoreHorizontal, Pencil, Trash2, Pause, Play } from "lucide-react";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Menu, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { ActionMenuContent } from "@plane/blocks/common";
import { useTranslation } from "@plane/i18n";
import type { TProjectIssueType, TWorkflowImpactRequest } from "@plane/types";
const key = "web.workflow_ui.types_settings";
export function TypesActions({
  type,
  canManage,
  busy,
  onEdit,
  onSave,
  onPreview,
}: {
  type: TProjectIssueType;
  canManage: boolean;
  busy: boolean;
  onEdit: (type: TProjectIssueType) => void;
  onSave: (data: Partial<TProjectIssueType>, id: string) => Promise<TProjectIssueType | false>;
  onPreview: (request: TWorkflowImpactRequest) => Promise<void>;
}) {
  const { t } = useTranslation();
  return (
    canManage && (
      <Menu>
        <MenuTrigger
          render={
            <IconButton
              variant="ghost"
              size="sm"
              icon={<MoreHorizontal className="size-4" />}
              aria-label={`${t("aria_labels.common.more_actions")} ${type.name}`}
            />
          }
        />
        <ActionMenuContent side="bottom" align="end">
          <MenuItem
            disabled={busy}
            icon={<Pencil className="size-3.5" />}
            label={t("edit")}
            onClick={() => onEdit(type)}
          />
          {!type.is_default && (
            <>
              <MenuItem
                disabled={busy || !type.is_active}
                icon={<Check className="size-3.5" />}
                label={t(`${key}.set_default`)}
                onClick={() => void onSave({ is_default: true }, type.id)}
              />
              <MenuItem
                disabled={busy}
                icon={type.is_active ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                label={t(type.is_active ? "web.workflow_ui.disable" : "web.workflow_ui.enable_one")}
                onClick={() => void onSave({ is_active: !type.is_active }, type.id)}
              />
            </>
          )}
          <hr className="my-1 border-subtle" />
          <MenuItem
            disabled={busy || type.is_default}
            variant="danger"
            icon={<Trash2 className="size-3.5" />}
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
    )
  );
}
