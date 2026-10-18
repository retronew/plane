import { useLayoutEffect, useState } from "react";
import useSWR, { unstable_serialize, useSWRConfig } from "swr";
import {
  MoreHorizontalOutline,
  AddOutline,
  DeleteOutline,
  EditOutline,
  ChevronDownOutline,
  MergeOutline,
} from "@makeplane/propel/icons";
import { EmptyStateDetailed, getCompactAsset } from "@plane/blocks/empty-state";
import { Button } from "@makeplane/propel/components/button";
import { Badge } from "@makeplane/propel/components/badge";
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
import { DataTable } from "@/components/common/data-table";
import type { DataTableColumn } from "@/components/common/data-table";
import { PropertyEditor } from "./property-editor";
import { PropertyMergeDialog } from "./property-merge-dialog";
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
  const [merging, setMerging] = useState(false);
  const [optionProperty, setOptionProperty] = useState<TCustomProperty | null>(null);
  return (
    <div className="space-y-4">
      <PropertiesHeader
        typeId={typeId}
        count={properties.length}
        canManage={canManage}
        search={search}
        setSearch={setSearch}
        onCreate={() => edit()}
        onAddExisting={() => setAdding(true)}
        onMerge={() => setMerging(true)}
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
      <PropertyMergeDialog
        open={merging}
        onOpenChange={setMerging}
        properties={properties}
        busy={busy}
        onPreview={(ids) => service.previewMerge(workspaceSlug, projectId, ids)}
        onMerge={(payload) => perform(() => service.merge(workspaceSlug, projectId, payload), true, true)}
      />
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
  // DataTable calls these render callbacks directly; they are not mounted as component types.
  /* oxlint-disable react/no-unstable-nested-components */
  const columns: DataTableColumn<TCustomProperty>[] = [
    {
      key: "name",
      content: label("title"),
      tdRender: (property) => (
        <div>
          <button
            disabled={!canManage}
            className="text-left font-medium text-primary hover:text-accent-primary"
            onClick={() => onEdit(property)}
          >
            {property.name}
          </button>
          {property.description && <p className="mt-1 text-12 text-tertiary">{property.description}</p>}
        </div>
      ),
    },
    {
      key: "type",
      content: label("property_type"),
      tdRender: (property) => <span className="text-secondary">{label(`types.${property.property_type}`)}</span>,
    },
    {
      key: "active",
      content: label("active"),
      tdRender: (property) => (
        <Switch
          aria-label={`${property.name} ${label("active")}`}
          size="sm"
          disabled={busy || !canManage}
          checked={typeId ? property.effective_is_active : property.is_active}
          onCheckedChange={(checked) => toggle(property, "is_active", checked)}
        />
      ),
    },
    {
      key: "required",
      content: label("required"),
      tdRender: (property) => (
        <Switch
          aria-label={`${property.name} ${label("required")}`}
          size="sm"
          disabled={busy || !canManage || property.property_type === "boolean" || !!property.config.read_only}
          checked={typeId ? property.effective_is_required : property.is_required}
          onCheckedChange={(checked) => toggle(property, "is_required", checked)}
        />
      ),
    },
    {
      key: "actions",
      content: t("aria_labels.common.more_actions"),
      thRender: () => <span className="sr-only">{t("aria_labels.common.more_actions")}</span>,
      tdRender: (property) =>
        canManage && (
          <div className="flex justify-end">
            <Menu>
              <MenuTrigger
                render={
                  <IconButton
                    variant="ghost"
                    size="sm"
                    aria-label={`${property.name} ${t("aria_labels.common.more_actions")}`}
                    icon={<MoreHorizontalOutline className="size-4" />}
                  />
                }
              />
              <ActionMenuContent>
                <MenuItem
                  onClick={() => onEdit(property)}
                  icon={<EditOutline className="size-4" />}
                  label={t("edit")}
                />
                {property.property_type === "dropdown" && (
                  <MenuItem onClick={() => onOptions(property)} label={label("options")} />
                )}
                {!typeId && (
                  <MenuItem
                    disabled={property.is_active}
                    onClick={() => onDelete(property)}
                    icon={<DeleteOutline className="size-4" />}
                    label={t("delete")}
                  />
                )}
              </ActionMenuContent>
            </Menu>
          </div>
        ),
    },
  ];
  return <DataTable<TCustomProperty> columns={columns} data={properties} keyExtractor={(property) => property.id} />;
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
  /* oxlint-enable react/no-unstable-nested-components */
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
                    icon={<DeleteOutline className="size-4" />}
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

type PerformPropertyOperation = (
  operation: () => Promise<unknown>,
  propagateError?: boolean,
  refreshAllTypes?: boolean
) => Promise<boolean>;
function usePropertiesData(
  workspaceSlug: string,
  projectId: string,
  typeId: string | undefined,
  search: string,
  onChanged?: () => Promise<unknown>
) {
  const { t } = useTranslation();
  const label = usePropertyLabel();
  const { mutate: mutateProjectProperties, cache } = useSWRConfig();
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
  const perform: PerformPropertyOperation = async (operation, propagateError = false, refreshAllTypes = false) => {
    if (busy || !canManage) return false;
    setBusy(true);
    try {
      try {
        await operation();
      } catch (operationError) {
        if (propagateError) throw operationError;
        reportError();
        return false;
      }
      // Once the mutation succeeds, a failed refresh must not offer the destructive operation again.
      try {
        const refreshedKeys = new Set<string>();
        if (refreshAllTypes) {
          await mutateProjectProperties(
            (key) => {
              const matches =
                Array.isArray(key) &&
                key[0] === "custom-properties" &&
                key[1] === workspaceSlug &&
                key[2] === projectId;
              if (matches) refreshedKeys.add(unstable_serialize(key));
              return matches;
            },
            undefined,
            { revalidate: true }
          );
        } else {
          await Promise.all([mutate(), refreshAvailable()]);
          refreshedKeys.add(unstable_serialize(["custom-properties", workspaceSlug, projectId, typeId ?? "all"]));
          if (typeId) refreshedKeys.add(unstable_serialize(["custom-properties", workspaceSlug, projectId, "all"]));
        }
        // SWR revalidation resolves even when its fetcher fails; inspect the resulting cache state.
        for (const key of refreshedKeys) {
          if (cache.get(key)?.error) throw cache.get(key)?.error;
        }
      } catch {
        setToast({ type: "error", title: t("error"), message: label("load_failed") });
      }
      try {
        await onChanged?.();
      } catch {
        setToast({ type: "error", title: t("error"), message: label("load_failed") });
      }
      return true;
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
  onMerge,
}: {
  typeId?: string;
  count: number;
  canManage: boolean;
  search: string;
  setSearch: (search: string) => void;
  onCreate: () => void;
  onAddExisting: () => void;
  onMerge: () => void;
}) {
  const { t } = useTranslation();
  const label = usePropertyLabel();
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h4 className="text-16 font-medium text-primary">{label(typeId ? "custom_properties" : "properties")}</h4>
          {!typeId && <Badge size="xs" variant="brand" label={String(count)} />}
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
                    size="md"
                    icon={<AddOutline className="size-4" />}
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
            <div className="inline-flex items-stretch gap-px [&>button:first-child]:rounded-e-none [&>button:last-child]:rounded-s-none">
              <Button stretch="auto" variant="primary" size="md" label={label("add_new")} onClick={onCreate} />
              <Menu>
                <MenuTrigger
                  render={
                    <IconButton
                      variant="primary"
                      size="md"
                      aria-label={t("aria_labels.common.more_actions")}
                      icon={<ChevronDownOutline className="size-4" />}
                    />
                  }
                />
                <ActionMenuContent>
                  <MenuItem onClick={onMerge} icon={<MergeOutline className="size-4" />} label={label("merge.title")} />
                </ActionMenuContent>
              </Menu>
            </div>
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
        <div className="flex items-center justify-center rounded-lg border border-subtle bg-surface-1 py-10">
          <EmptyStateDetailed
            align="center"
            className="gap-3"
            asset={getCompactAsset("custom-properties")}
            title={label(search ? "no_results" : "empty_title")}
            description={label("empty_description")}
          />
        </div>
      ) : (
        <PropertiesTable {...tableProps} />
      )}
    </>
  );
}
