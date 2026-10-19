/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { useState, type ReactNode } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Tag,
  Trash2,
  Ungroup,
} from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Menu, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { ActionMenuContent } from "@plane/blocks/common";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { cn } from "@plane/utils";
import { useTranslation } from "@plane/i18n";
import { EmptyStateCompact } from "@plane/blocks/empty-state";
import { Loader } from "@plane/blocks/skeleton";
import { SortableItem, SortableProvider } from "@plane/blocks/sortable";
import type { SortableChange } from "@plane/blocks/sortable";
import { setToast } from "@plane/blocks/toast";
import type { IIssueLabel, IState } from "@plane/types";
import { useLabel } from "@/hooks/store/use-label";
import { useUserPermissions } from "@/hooks/store/user";
import { SettingsHeading } from "@/components/settings/heading";
import { StateForm } from "@/components/project-states/create-update/form";
import { STATE_ROW_CLASS_NAME, STATE_ROW_DIVIDER_CLASS_NAME } from "@/components/project-states/row-layout";
import { StateSummary } from "@/components/project-states/state-summary";
import { DeleteLabelModal } from "./delete-label-modal";
import { getSortedLabelPayload, ROOT_LABEL_GROUP } from "./sort-label";

type Draft = { label: IIssueLabel | null; colorOpen: boolean };

function LabelDraftForm({
  draft,
  onSubmit,
  onCancel,
}: {
  draft: Draft;
  onSubmit: (data: Partial<IState>) => Promise<{ status: string }>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  return (
    <StateForm
      key={draft.label?.id ?? "new"}
      kind="label"
      focusNameOnOpen={!draft.label}
      colorPickerInitiallyOpen={draft.colorOpen}
      data={{ name: draft.label?.name ?? "", color: draft.label?.color ?? "#60646c" }}
      onSubmit={onSubmit}
      onCancel={onCancel}
      buttonDisabled={false}
      buttonTitle={t(draft.label ? "update" : "add")}
    />
  );
}

function LabelListContent({
  projectLabels,
  entries,
  draft,
  editor,
  isEditable,
  busy,
  saveOrder,
  children,
}: {
  projectLabels: IIssueLabel[] | undefined;
  entries: IIssueLabel[];
  draft: Draft | null;
  editor: ReactNode;
  isEditable: boolean;
  busy: boolean;
  saveOrder: (change: SortableChange) => Promise<void>;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  if (!projectLabels)
    return (
      <Loader className="space-y-3">
        <Loader.Item height="56px" />
        <Loader.Item height="56px" />
      </Loader>
    );
  if (!entries.length && !draft)
    return (
      <EmptyStateCompact
        assetKey="label"
        assetClassName="size-20"
        title={t("settings_empty_state.labels.title")}
        description={t("settings_empty_state.labels.description")}
        align="center"
        rootClassName="min-h-72 rounded-lg border border-subtle px-6 py-12"
      />
    );
  return (
    <div className="rounded-xl border border-subtle bg-layer-2 px-1.5 py-0.5">
      {draft && !draft.label && <div className="pl-4">{editor}</div>}
      <SortableProvider disabled={!isEditable || busy} onSortEnd={saveOrder}>
        {children}
      </SortableProvider>
    </div>
  );
}

export const ProjectSettingsLabelList = observer(function ProjectSettingsLabelList() {
  const { workspaceSlug, projectId } = useParams();
  const { t } = useTranslation();
  const { projectLabels, createLabel, updateLabel } = useLabel();
  const { allowPermissions } = useUserPermissions();
  const isEditable = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<IIssueLabel | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const busy = !!draft || savingOrder;
  const entries = projectLabels ?? [];
  const begin = (label: IIssueLabel | null, colorOpen = false) => setDraft({ label, colorOpen });
  const saveOrder = async (change: SortableChange) => {
    if (!workspaceSlug || !projectId || !isEditable || busy) return;
    const payload = getSortedLabelPayload(entries, change);
    if (!payload) return;
    setSavingOrder(true);
    try {
      await updateLabel(workspaceSlug.toString(), projectId.toString(), change.id, payload);
    } catch (error) {
      setToast({ type: "error", title: t("web.category_order_error") });
      throw error;
    } finally {
      setSavingOrder(false);
    }
  };
  const save = async (data: Partial<IState>) => {
    if (!draft || !workspaceSlug || !projectId) return { status: "error" };
    const payload = { name: data.name, color: data.color };
    try {
      if (draft.label) await updateLabel(workspaceSlug.toString(), projectId.toString(), draft.label.id, payload);
      else await createLabel(workspaceSlug.toString(), projectId.toString(), payload);
      setDraft(null);
      return { status: "success" };
    } catch (error) {
      const details = error as { name?: string[]; detail?: string; error?: string };
      if (details.name?.includes("LABEL_NAME_ALREADY_EXISTS")) return { status: "already_exists" };
      setToast({
        type: "error",
        title: t("toast.error"),
        message: details.detail ?? details.error ?? t("project_settings.labels.toast.error"),
      });
      return { status: "error" };
    }
  };
  const editor = draft && <LabelDraftForm draft={draft} onSubmit={save} onCancel={() => setDraft(null)} />;
  const renderRows = (siblings: IIssueLabel[], parent: string | null) =>
    siblings.map((label, index) => {
      const children = entries.filter((entry) => entry.parent === label.id);
      if (draft?.label?.id === label.id)
        return (
          <div key={label.id} className={cn(STATE_ROW_DIVIDER_CLASS_NAME, "pl-4")}>
            {editor}
            {children.length > 0 && <div className="ml-6">{renderRows(children, label.id)}</div>}
          </div>
        );
      return (
        <SortableItem
          key={label.id}
          id={label.id}
          index={index}
          group={parent ?? ROOT_LABEL_GROUP}
          disabled={!isEditable || busy}
          className={STATE_ROW_DIVIDER_CLASS_NAME}
        >
          {({ handleRef }) => (
            <>
              <div className={cn(STATE_ROW_CLASS_NAME, isEditable && "pl-12")}>
                {isEditable && (
                  <button
                    hidden={siblings.length < 2}
                    ref={handleRef}
                    type="button"
                    disabled={busy}
                    aria-label={`${t("web.reorder_category")} ${label.name}`}
                    title={t("web.reorder_category_hint")}
                    className="absolute top-1/2 left-1 grid size-10 -translate-y-1/2 cursor-grab touch-none place-items-center rounded-md text-tertiary outline-none hover:bg-layer-2-active hover:text-primary focus-visible:ring-2 focus-visible:ring-accent-strong active:cursor-grabbing disabled:cursor-not-allowed disabled:text-disabled"
                  >
                    <GripVertical className="size-3" />
                  </button>
                )}
                <button
                  type="button"
                  disabled={!isEditable || busy}
                  data-project-label={label.id}
                  onClick={(event) =>
                    begin(label, event.target instanceof Element && !!event.target.closest("[data-state-color-target]"))
                  }
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
                >
                  <StateSummary
                    icon={<Tag className="size-4" style={{ color: label.color }} />}
                    color={label.color}
                    name={label.name}
                  />
                </button>
                {children.length > 0 && (
                  <IconButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={label.name}
                    aria-expanded={!collapsed.has(label.id)}
                    icon={<ChevronDown className={collapsed.has(label.id) ? "size-4 -rotate-90" : "size-4"} />}
                    onClick={() =>
                      setCollapsed((current) => {
                        const next = new Set(current);
                        if (next.has(label.id)) next.delete(label.id);
                        else next.add(label.id);
                        return next;
                      })
                    }
                  />
                )}
                {isEditable && (
                  <Menu>
                    <MenuTrigger
                      render={
                        <IconButton
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          aria-label={`${t("aria_labels.common.more_actions")} ${label.name}`}
                          icon={<MoreHorizontal className="size-4" />}
                        />
                      }
                    />
                    <ActionMenuContent align="end">
                      <MenuItem label={t("edit")} icon={<Pencil className="size-3.5" />} onClick={() => begin(label)} />
                      {[-1, 1].map((direction) => (
                        <MenuItem
                          key={direction}
                          label={t(direction < 0 ? "web.move_label_up" : "web.move_label_down")}
                          icon={direction < 0 ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
                          disabled={busy || index + direction < 0 || index + direction >= siblings.length}
                          onClick={() => {
                            const group = parent ?? ROOT_LABEL_GROUP;
                            void saveOrder({
                              id: label.id,
                              initialIndex: index,
                              index: index + direction,
                              initialGroup: group,
                              group,
                            }).catch(() => undefined);
                          }}
                        />
                      ))}
                      {label.parent && (
                        <MenuItem
                          label={t("web.remove_from_group")}
                          icon={<Ungroup className="size-3.5" />}
                          onClick={() => {
                            if (!workspaceSlug || !projectId) return;
                            void updateLabel(workspaceSlug.toString(), projectId.toString(), label.id, {
                              parent: null,
                            }).catch(() =>
                              setToast({
                                type: "error",
                                title: t("toast.error"),
                                message: t("common.something_went_wrong"),
                              })
                            );
                          }}
                        />
                      )}
                      <MenuItem
                        variant="danger"
                        label={t("delete")}
                        icon={<Trash2 className="size-3.5" />}
                        onClick={() => setDeleting(label)}
                      />
                    </ActionMenuContent>
                  </Menu>
                )}
              </div>
              {children.length > 0 && !collapsed.has(label.id) && (
                <div className="ml-6">{renderRows(children, label.id)}</div>
              )}
            </>
          )}
        </SortableItem>
      );
    });
  return (
    <>
      <DeleteLabelModal isOpen={!!deleting} data={deleting} onClose={() => setDeleting(null)} />
      <SettingsHeading
        title={t("project_settings.labels.heading")}
        description={t("project_settings.labels.description")}
        control={
          isEditable &&
          !draft && (
            <Button
              variant="primary"
              size="md"
              stretch="auto"
              disabled={savingOrder}
              onClick={() => begin(null)}
              label={t("common.add_label")}
            />
          )
        }
      />
      <div className="mt-6 w-full">
        <LabelListContent
          projectLabels={projectLabels}
          entries={entries}
          draft={draft}
          editor={editor}
          isEditable={isEditable}
          busy={busy}
          saveOrder={saveOrder}
        >
          {renderRows(
            entries.filter((entry) => !entry.parent || !entries.some((candidate) => candidate.id === entry.parent)),
            null
          )}
        </LabelListContent>
      </div>
    </>
  );
});
