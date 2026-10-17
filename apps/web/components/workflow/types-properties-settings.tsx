import { useLayoutEffect, useState } from "react";
import useSWR from "swr";
import { MoreHorizontal, Plus, Shapes, Trash2, Pencil } from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Switch } from "@makeplane/propel/components/switch";
import { Checkbox } from "@makeplane/propel/components/checkbox";
import { ExpandableSearch } from "@makeplane/propel/components/expandable-search";
import { InputField } from "@makeplane/propel/components/input-field";
import { Menu, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import {
  Dialog,
  DialogContent,
  DialogMain,
  DialogHeader,
  DialogHeading,
  DialogTitle,
  DialogBody,
  DialogActions,
} from "@makeplane/propel/components/dialog";
import { ActionMenuContent } from "@plane/blocks/common";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { TProjectIssueType } from "@plane/types";
import { CustomPropertiesService } from "@/services/project/custom-properties.service";
import type { TCustomProperty } from "@/services/project/custom-properties.types";
import { PropertyEditor } from "./property-editor";
import type { PropertyDraft } from "./property-editor";

const service = new CustomPropertiesService();
export type WorkItemPropertiesSettingsProps = {
  projectId: string;
  workspaceSlug: string;
  types: TProjectIssueType[];
  typeId?: string;
  onChanged?: () => Promise<unknown>;
};

export function WorkItemPropertiesSettings({
  projectId,
  workspaceSlug,
  typeId,
  onChanged,
}: WorkItemPropertiesSettingsProps) {
  const [search, setSearch] = useState("");
  const { error, mutate, isLoading, canManage, busy, properties, filtered, perform, toggle, propertyById, candidates } =
    usePropertiesData(workspaceSlug, projectId, typeId, search, onChanged);
  const { draft, setDraft, editorOpen, setEditorOpen, edit, save } = usePropertyEditor(
    workspaceSlug,
    projectId,
    typeId,
    perform
  );
  const [deleting, setDeleting] = useState<TCustomProperty | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [optionProperty, setOptionProperty] = useState<TCustomProperty | null>(null);
  return (
    <div className="space-y-6 pt-6">
      <PropertiesHeader
        typeId={typeId}
        count={properties.length}
        canManage={canManage}
        search={search}
        setSearch={setSearch}
        onCreate={() => edit()}
        onAddExisting={() => setAdding(true)}
      />
      <PropertiesContent
        error={error}
        isLoading={isLoading}
        search={search}
        properties={filtered}
        canManage={canManage}
        busy={busy}
        typeId={typeId}
        onEdit={edit}
        onOptions={setOptionProperty}
        onDelete={(property) => {
          setDeleting(property);
          setDeleteOpen(true);
        }}
        toggle={toggle}
        onRetry={() => void mutate()}
      />
      {draft && (
        <PropertyEditor
          key={draft.id ?? "new"}
          open={editorOpen}
          draft={draft}
          busy={busy}
          onClose={() => setEditorOpen(false)}
          onComplete={(open) => {
            if (!open) setDraft(null);
          }}
          onSave={save}
        />
      )}
      <DeletePropertyDialog
        open={deleteOpen}
        busy={busy}
        property={deleting}
        onOpenChange={setDeleteOpen}
        onComplete={() => setDeleting(null)}
        onDelete={() => {
          if (deleting)
            void perform(() => service.remove(workspaceSlug, projectId, deleting.id)).then((ok) => {
              if (ok) setDeleteOpen(false);
              return ok;
            });
        }}
      />
      <AddPropertiesDialog
        open={adding}
        onOpenChange={setAdding}
        busy={busy}
        candidates={candidates}
        onAdd={(selectedProperties) =>
          perform(async () => {
            if (typeId)
              await Promise.all(
                selectedProperties.map((property) =>
                  service.bindType(workspaceSlug, projectId, typeId, property.id, {
                    is_active: true,
                    is_required: property.is_required,
                  })
                )
              );
          })
        }
      />
      {optionProperty && (
        <PropertyOptionsDialog
          key={optionProperty.id}
          property={propertyById.get(optionProperty.id)}
          busy={busy}
          onComplete={() => setOptionProperty(null)}
          onRemove={(propertyId, optionId) =>
            perform(() => service.removeOption(workspaceSlug, projectId, propertyId, optionId))
          }
          onSave={(propertyId, name, optionId) =>
            perform(() => service.saveOption(workspaceSlug, projectId, propertyId, { name }, optionId))
          }
        />
      )}
    </div>
  );
}

const usePropertyLabel = () => {
  const { t } = useTranslation();
  return (key: string) => t(`web.work_item_properties.${key}`);
};

type PropertiesTableProps = {
  properties: TCustomProperty[];
  canManage: boolean;
  busy: boolean;
  typeId?: string;
  onEdit: (property: TCustomProperty) => void;
  onOptions: (property: TCustomProperty) => void;
  onDelete: (property: TCustomProperty) => void;
  toggle: (property: TCustomProperty, field: "is_active" | "is_required", value: boolean) => void;
};
function PropertiesTable({
  properties,
  canManage,
  busy,
  typeId,
  onEdit,
  onOptions,
  onDelete,
  toggle,
}: PropertiesTableProps) {
  const { t } = useTranslation();
  const label = usePropertyLabel();
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-13">
        <thead>
          <tr className="border-b border-subtle text-tertiary">
            <th className="font-normal py-3">{label("title")}</th>
            <th className="font-normal px-3 py-3">{label("property_type")}</th>
            <th className="font-normal px-3 py-3">{label("active")}</th>
            <th className="font-normal px-3 py-3">{label("required")}</th>
            <th className="w-10">
              <span className="sr-only">{t("aria_labels.common.more_actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {properties.map((property) => (
            <tr key={property.id} className="border-b border-subtle">
              <td className="py-4">
                <button
                  disabled={!canManage}
                  className="text-left font-medium text-primary hover:text-accent-primary"
                  onClick={() => onEdit(property)}
                >
                  {property.name}
                </button>
                {property.description && <p className="mt-1 text-12 text-tertiary">{property.description}</p>}
              </td>
              <td className="px-3 text-secondary">{label(`types.${property.property_type}`)}</td>
              <td className="px-3">
                <Switch
                  aria-label={`${property.name} ${label("active")}`}
                  size="sm"
                  disabled={busy || !canManage}
                  checked={typeId ? property.effective_is_active : property.is_active}
                  onCheckedChange={(checked) => toggle(property, "is_active", checked)}
                />
              </td>
              <td className="px-3">
                <Switch
                  aria-label={`${property.name} ${label("required")}`}
                  size="sm"
                  disabled={busy || !canManage || property.property_type === "boolean" || !!property.config.read_only}
                  checked={typeId ? property.effective_is_required : property.is_required}
                  onCheckedChange={(checked) => toggle(property, "is_required", checked)}
                />
              </td>
              <td>
                {canManage && (
                  <Menu>
                    <MenuTrigger
                      render={
                        <IconButton
                          variant="ghost"
                          size="sm"
                          aria-label={`${property.name} ${t("aria_labels.common.more_actions")}`}
                          icon={<MoreHorizontal className="size-4" />}
                        />
                      }
                    />
                    <ActionMenuContent>
                      <MenuItem
                        onClick={() => onEdit(property)}
                        icon={<Pencil className="size-3.5" />}
                        label={t("edit")}
                      />
                      {property.property_type === "dropdown" && (
                        <MenuItem onClick={() => onOptions(property)} label={label("options")} />
                      )}
                      {!typeId && (
                        <MenuItem
                          disabled={property.is_active}
                          onClick={() => onDelete(property)}
                          icon={<Trash2 className="size-3.5" />}
                          label={t("delete")}
                        />
                      )}
                    </ActionMenuContent>
                  </Menu>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function DeletePropertyDialog({
  open,
  busy,
  property,
  onOpenChange,
  onComplete,
  onDelete,
}: {
  open: boolean;
  busy: boolean;
  property: TCustomProperty | null;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const label = usePropertyLabel();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(nextOpen) => {
        if (!nextOpen) onComplete();
      }}
    >
      <DialogContent size="sm">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>{label("delete_property")}</DialogTitle>
            </DialogHeading>
          </DialogHeader>
          <DialogBody>
            <p className="text-13 text-secondary">{label("delete_description")}</p>
          </DialogBody>
          <DialogActions>
            <Button
              stretch="auto"
              variant="ghost"
              size="md"
              label={t("cancel")}
              disabled={busy}
              onClick={() => onOpenChange(false)}
            />
            <Button
              stretch="auto"
              variant="primary"
              size="md"
              label={t("delete")}
              disabled={busy || !property}
              onClick={onDelete}
            />
          </DialogActions>
        </DialogMain>
      </DialogContent>
    </Dialog>
  );
}
function AddPropertiesDialog({
  open,
  busy,
  candidates,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  busy: boolean;
  candidates: TCustomProperty[];
  onOpenChange: (open: boolean) => void;
  onAdd: (properties: TCustomProperty[]) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const label = usePropertyLabel();
  const [selected, setSelected] = useState<string[]>([]);
  const selectedSet = new Set(selected);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(nextOpen) => {
        if (!nextOpen) setSelected([]);
      }}
    >
      <DialogContent size="sm">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>{label("add_property")}</DialogTitle>
            </DialogHeading>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-3">
              {candidates.map((property) => (
                <Checkbox
                  key={property.id}
                  label={property.name}
                  checked={selectedSet.has(property.id)}
                  onCheckedChange={(checked) =>
                    setSelected((ids) => (checked ? [...ids, property.id] : ids.filter((id) => id !== property.id)))
                  }
                />
              ))}
              {!candidates.length && (
                <p className="py-8 text-center text-13 text-tertiary">{label("none_available")}</p>
              )}
            </div>
          </DialogBody>
          <DialogActions>
            <Button stretch="auto" variant="ghost" size="md" label={t("cancel")} onClick={() => onOpenChange(false)} />
            <Button
              stretch="auto"
              variant="primary"
              size="md"
              disabled={busy || !selected.length}
              label={t("add")}
              onClick={() =>
                void onAdd(candidates.filter((property) => selectedSet.has(property.id))).then((ok) => {
                  if (ok) onOpenChange(false);
                  return ok;
                })
              }
            />
          </DialogActions>
        </DialogMain>
      </DialogContent>
    </Dialog>
  );
}
function PropertyOptionsDialog({
  property,
  busy,
  onComplete,
  onRemove,
  onSave,
}: {
  property?: TCustomProperty;
  busy: boolean;
  onComplete: () => void;
  onRemove: (propertyId: string, optionId: string) => Promise<boolean>;
  onSave: (propertyId: string, name: string, optionId?: string) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const label = usePropertyLabel();
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const [optionName, setOptionName] = useState("");
  const [editingOptionId, setEditingOptionId] = useState<string | undefined>();
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(nextOpen) => {
        if (!nextOpen) onComplete();
      }}
    >
      <DialogContent size="sm">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>{label("options")}</DialogTitle>
            </DialogHeading>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-3">
              {(property?.options ?? []).map((option) => (
                <div key={option.id} className="flex items-center justify-between gap-3 text-13">
                  <button
                    type="button"
                    className="text-left hover:text-accent-primary"
                    disabled={busy}
                    onClick={() => {
                      setEditingOptionId(option.id);
                      setOptionName(option.name);
                    }}
                  >
                    {option.name}
                  </button>
                  <IconButton
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    aria-label={`${t("delete")} ${option.name}`}
                    icon={<Trash2 className="size-3.5" />}
                    onClick={() => {
                      if (property) void onRemove(property.id, option.id);
                    }}
                  />
                </div>
              ))}
              <InputField
                orientation="vertical"
                size="md"
                label={label("option_name")}
                value={optionName}
                onChange={(event) => setOptionName(event.target.value)}
              />
            </div>
          </DialogBody>
          <DialogActions>
            <Button stretch="auto" variant="ghost" size="md" label={t("close")} onClick={() => setOpen(false)} />
            <Button
              stretch="auto"
              variant="primary"
              size="md"
              disabled={busy || !optionName.trim()}
              label={t(editingOptionId ? "save" : "add")}
              onClick={() => {
                if (property)
                  void onSave(property.id, optionName.trim(), editingOptionId).then((ok) => {
                    if (ok) {
                      setOptionName("");
                      setEditingOptionId(undefined);
                    }
                    return ok;
                  });
              }}
            />
          </DialogActions>
        </DialogMain>
      </DialogContent>
    </Dialog>
  );
}

type PerformPropertyOperation = (operation: () => Promise<unknown>) => Promise<boolean>;
function usePropertiesData(
  workspaceSlug: string,
  projectId: string,
  typeId: string | undefined,
  search: string,
  onChanged?: () => Promise<unknown>
) {
  const { t } = useTranslation();
  const label = usePropertyLabel();
  const { data, error, mutate, isLoading } = useSWR(
    ["custom-properties", workspaceSlug, projectId, typeId ?? "all"],
    () => service.list(workspaceSlug, projectId, typeId)
  );
  const { data: available, mutate: refreshAvailable } = useSWR(
    typeId ? ["custom-properties", workspaceSlug, projectId, "all"] : null,
    () => service.list(workspaceSlug, projectId)
  );
  const [busy, setBusy] = useState(false);
  const canManage = data?.can_manage ?? false;
  const properties = (data?.results ?? []).filter(
    (property) => !typeId || property.type_settings.some((binding) => binding.type_id === typeId)
  );
  const filtered = properties.filter((property) => property.name.toLowerCase().includes(search.trim().toLowerCase()));
  const reportError = () => setToast({ type: "error", title: t("error"), message: label("save_failed") });
  const perform = async (operation: () => Promise<unknown>) => {
    if (busy || !canManage) return false;
    setBusy(true);
    try {
      await operation();
      await mutate();
      await refreshAvailable();
      try {
        await onChanged?.();
      } catch {
        setToast({ type: "error", title: t("error"), message: label("load_failed") });
      }
      return true;
    } catch {
      reportError();
      return false;
    } finally {
      setBusy(false);
    }
  };
  const toggle = (property: TCustomProperty, field: "is_active" | "is_required", value: boolean) =>
    void perform(() =>
      typeId
        ? service.bindType(workspaceSlug, projectId, typeId, property.id, {
            is_active: property.effective_is_active ?? property.is_active,
            is_required: property.effective_is_required ?? property.is_required,
            [field]: value,
          })
        : service.save(workspaceSlug, projectId, { [field]: value }, property.id)
    );
  const propertyById = new Map(properties.map((property) => [property.id, property]));
  const candidates = (available?.results ?? []).filter(
    (property) => !property.type_settings.some((binding) => binding.type_id === typeId && binding.is_active)
  );
  return { error, mutate, isLoading, canManage, busy, properties, filtered, perform, toggle, propertyById, candidates };
}
function usePropertyEditor(
  workspaceSlug: string,
  projectId: string,
  typeId: string | undefined,
  perform: PerformPropertyOperation
) {
  const [draft, setDraft] = useState<PropertyDraft | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const edit = (property?: TCustomProperty) => {
    setDraft(
      property
        ? { ...property, description: property.description ?? "", config: property.config ?? {} }
        : { name: "", description: "", property_type: "text", config: {}, is_active: true, is_required: false }
    );
    setEditorOpen(true);
  };
  const save = async (value: PropertyDraft) => {
    const saved = await perform(async () => {
      const { id, options, name, description, property_type, config, is_active, is_required } = value;
      const payload = { name, description, property_type, config, is_active, is_required };
      await service.save(
        workspaceSlug,
        projectId,
        {
          ...payload,
          ...(!id
            ? {
                type_id: typeId,
                options: options
                  ?.filter((option) => option.name.trim())
                  .map((option) => ({ name: option.name.trim(), color: option.color, sort_order: option.sort_order })),
              }
            : {}),
        },
        id
      );
    });
    if (saved) setEditorOpen(false);
  };
  return { draft, setDraft, editorOpen, setEditorOpen, edit, save };
}

function PropertiesHeader({
  typeId,
  count,
  canManage,
  search,
  setSearch,
  onCreate,
  onAddExisting,
}: {
  typeId?: string;
  count: number;
  canManage: boolean;
  search: string;
  setSearch: (search: string) => void;
  onCreate: () => void;
  onAddExisting: () => void;
}) {
  const { t } = useTranslation();
  const label = usePropertyLabel();
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h4 className="text-16 font-medium text-primary">{label(typeId ? "custom_properties" : "properties")}</h4>
          {!typeId && <span className="text-13 text-tertiary">{count}</span>}
        </div>
        {!typeId && <p className="mt-1 text-13 text-tertiary">{label("description")}</p>}
      </div>
      <div className="flex items-center gap-2">
        <ExpandableSearch
          size="md"
          aria-label={t("search")}
          clearLabel={t("common.clear")}
          value={search}
          onValueChange={(value) => setSearch(value ?? "")}
          placeholder={t("search")}
        />
        {canManage &&
          (typeId ? (
            <Menu>
              <MenuTrigger
                render={
                  <Button
                    stretch="auto"
                    variant="primary"
                    size="sm"
                    icon={<Plus className="size-3.5" />}
                    label={label("add_property")}
                  />
                }
              />
              <ActionMenuContent>
                <MenuItem onClick={onCreate} label={label("create_new")} />
                <MenuItem
                  onClick={() => {
                    onAddExisting();
                  }}
                  label={label("add_existing")}
                />
              </ActionMenuContent>
            </Menu>
          ) : (
            <Button stretch="auto" variant="primary" size="sm" label={label("add_new")} onClick={onCreate} />
          ))}
      </div>
    </div>
  );
}
function PropertiesContent({
  error,
  isLoading,
  search,
  onRetry,
  ...tableProps
}: PropertiesTableProps & {
  error: unknown;
  isLoading: boolean;
  search: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const label = usePropertyLabel();
  const { properties } = tableProps;
  return (
    <>
      {error ? (
        <div role="alert" className="space-y-3 text-13 text-secondary">
          <p>{label("load_failed")}</p>
          <Button stretch="auto" size="sm" variant="secondary" label={label("retry")} onClick={onRetry} />
        </div>
      ) : isLoading ? (
        <p className="py-6 text-13 text-tertiary">{t("loading")}</p>
      ) : !properties.length ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-2 text-center">
          <Shapes className="mb-3 size-10 text-tertiary" />
          <h3 className="text-16 font-semibold text-primary">{label(search ? "no_results" : "empty_title")}</h3>
          <p className="text-13 text-tertiary">{label("empty_description")}</p>
        </div>
      ) : (
        <PropertiesTable {...tableProps} />
      )}
    </>
  );
}
