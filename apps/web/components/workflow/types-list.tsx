import { useState } from "react";
import { Link } from "react-router";
import {
  FilterOutline,
  SortAscendingOutline,
  SortDescendingOutline,
  StackLayersOutline,
  PlayOutline,
  PauseOutline,
} from "@makeplane/propel/icons";
import { ExpandableSearch } from "@makeplane/propel/components/expandable-search";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Badge } from "@makeplane/propel/components/badge";
import { Menu, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { ActionMenuContent } from "@plane/blocks/common";
import { TypesLogo } from "./types-logo";
import { useTranslation } from "@plane/i18n";
import type { TProjectIssueType, TProjectWorkflow, TWorkflowImpactRequest } from "@plane/types";
import { DataTable } from "@/components/common/data-table";
import type { DataTableColumn } from "@/components/common/data-table";
import { TypesActions } from "./types-actions";
const key = "web.workflow_ui.types_settings";
const emptyWorkflows: TProjectWorkflow[] = [];
const logo = (type: TProjectIssueType) => <TypesLogo type={type} size={14} backgroundSize={20} />;
import { filterIssueTypes } from "./types-settings-utils";
import type { TypesStatusFilter } from "./types-settings-utils";
export function TypesList({
  types,
  workflows = emptyWorkflows,
  canManage,
  busy,
  base,
  onEdit: edit,
  onSave,
  onPreview,
}: {
  types: TProjectIssueType[];
  workflows?: TProjectWorkflow[];
  canManage: boolean;
  busy: boolean;
  base: string;
  onEdit: (type: Partial<TProjectIssueType>) => void;
  onSave: (data: Partial<TProjectIssueType>, id: string) => Promise<TProjectIssueType | false>;
  onPreview: (request: TWorkflowImpactRequest) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState<TypesStatusFilter>("all"),
    [descending, setDescending] = useState(false);
  const rows = filterIssueTypes(types, search, status, descending);
  const badge = (type: TProjectIssueType) =>
    type.is_default ? <Badge size="xs" variant="neutral" label={t("common.default")} /> : null;
  // DataTable calls these render callbacks directly; they are not mounted as component types.
  /* oxlint-disable react/no-unstable-nested-components */
  const columns: DataTableColumn<TProjectIssueType>[] = [
    {
      key: "name",
      content: t("web.workflow_ui.issue_types"),
      tdRender: (type) => (
        <Link to={`${base}types/${type.id}/properties/`} className="flex items-center gap-2 text-primary">
          {logo(type)}
          <span>{type.name}</span>
          {badge(type)}
        </Link>
      ),
    },
    {
      key: "status",
      content: t("web.workflow_ui.columns.status"),
      tdRender: (type) => (
        <Badge
          size="xs"
          variant={type.is_active ? "success" : "neutral"}
          label={t(type.is_active ? "web.workflow_ui.active" : "web.workflow_ui.inactive")}
        />
      ),
    },
    {
      key: "properties",
      content: t(`${key}.property_count`),
      tdRender: (type) => (
        <div className="flex items-center justify-between gap-3 text-secondary">
          <span>{type.properties_count ?? "—"}</span>
          <TypesActions
            type={type}
            workflows={workflows}
            canManage={canManage}
            busy={busy}
            onEdit={edit}
            onSave={onSave}
            onPreview={onPreview}
          />
        </div>
      ),
    },
  ];
  /* oxlint-enable react/no-unstable-nested-components */
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h4 className="text-h6-medium text-primary">{t(`${key}.types`)}</h4>
          <Badge size="xs" variant="brand" label={String(types.length)} />
        </div>
        <div className="flex items-center gap-2">
          <ExpandableSearch
            size="md"
            aria-label={t(`${key}.search`)}
            clearLabel={t("common.clear")}
            value={search}
            onValueChange={(value) => setSearch(value ?? "")}
            placeholder={t(`${key}.search`)}
          />
          <Menu>
            <MenuTrigger
              render={
                <IconButton
                  size="md"
                  variant="secondary"
                  icon={<FilterOutline className="size-4" />}
                  aria-label={t(`${key}.filter_status`)}
                />
              }
            />
            <ActionMenuContent>
              {(["all", "active", "inactive"] as const).map((value) => (
                <MenuItem
                  key={value}
                  selected={status === value}
                  icon={
                    value === "all" ? (
                      <StackLayersOutline className="size-4" />
                    ) : value === "active" ? (
                      <PlayOutline className="size-4" />
                    ) : (
                      <PauseOutline className="size-4" />
                    )
                  }
                  label={t(value === "all" ? "common.all" : `web.workflow_ui.${value}`)}
                  onClick={() => setStatus(value)}
                />
              ))}
            </ActionMenuContent>
          </Menu>
          <Menu>
            <MenuTrigger
              render={
                <Button
                  stretch="auto"
                  size="md"
                  variant="secondary"
                  icon={<SortAscendingOutline className="size-4" />}
                  label={t("web.workflow_ui.types_settings.sort")}
                />
              }
            />
            <ActionMenuContent>
              <MenuItem
                selected={!descending}
                icon={<SortAscendingOutline className="size-4" />}
                label={t("web.workflow_ui.sort_name")}
                onClick={() => setDescending(false)}
              />
              <MenuItem
                selected={descending}
                icon={<SortDescendingOutline className="size-4" />}
                label={t("web.workflow_ui.sort_name_desc")}
                onClick={() => setDescending(true)}
              />
            </ActionMenuContent>
          </Menu>
          {canManage && (
            <Button
              stretch="auto"
              size="md"
              variant="primary"
              label={t(`${key}.add`)}
              onClick={() => edit({ name: "", description: "" })}
            />
          )}
        </div>
      </div>
      <div>
        <DataTable<TProjectIssueType> columns={columns} data={rows} keyExtractor={(type) => type.id} />
        {!rows.length && <p className="py-8 text-center text-body-xs-regular text-secondary">{t(`${key}.empty`)}</p>}
      </div>
    </>
  );
}
