import { useState } from "react";
import { Link } from "react-router";
import { ArrowDownAZ, Check, Filter, Search } from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Badge } from "@makeplane/propel/components/badge";
import { Menu, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { ActionMenuContent } from "@plane/blocks/common";
import { TypesLogo } from "./types-logo";
import { useTranslation } from "@plane/i18n";
import type { TProjectIssueType, TWorkflowImpactRequest } from "@plane/types";
import { TypesActions } from "./types-actions";
const key = "web.workflow_ui.types_settings";
const logo = (type: TProjectIssueType) => <TypesLogo type={type} />;
import { filterIssueTypes } from "./types-settings-utils";
import type { TypesStatusFilter } from "./types-settings-utils";
export function TypesList({
  types,
  canManage,
  busy,
  base,
  onEdit: edit,
  onSave,
  onPreview,
}: {
  types: TProjectIssueType[];
  canManage: boolean;
  busy: boolean;
  base: string;
  onEdit: (type: Partial<TProjectIssueType>) => void;
  onSave: (data: Partial<TProjectIssueType>, id: string) => Promise<TProjectIssueType | false>;
  onPreview: (request: TWorkflowImpactRequest) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState(""),
    [searchOpen, setSearchOpen] = useState(false),
    [status, setStatus] = useState<TypesStatusFilter>("all"),
    [descending, setDescending] = useState(false);
  const rows = filterIssueTypes(types, search, status, descending);
  const badge = (type: TProjectIssueType) =>
    type.is_default ? <Badge size="xs" variant="neutral" label={t("common.default")} /> : null;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 py-5">
        <h4 className="flex items-center gap-2 text-body-sm-medium text-primary">
          {t(`${key}.types`)}
          <span className="text-secondary">{types.length}</span>
        </h4>
        <div className="flex items-center gap-2">
          {searchOpen && (
            <input
              type="search"
              aria-label={t(`${key}.search`)}
              className="w-44 rounded border border-subtle bg-layer-1 px-2 py-1 text-body-xs-regular"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          )}
          <IconButton
            size="sm"
            variant="ghost"
            icon={<Search className="size-4" />}
            aria-label={t(`${key}.search`)}
            onClick={() => {
              setSearchOpen(!searchOpen);
              if (searchOpen) setSearch("");
            }}
          />
          <Menu>
            <MenuTrigger
              render={
                <IconButton
                  size="sm"
                  variant={status === "all" ? "ghost" : "secondary"}
                  icon={<Filter className="size-4" />}
                  aria-label={t(`${key}.filter_status`)}
                />
              }
            />
            <ActionMenuContent>
              {(["all", "active", "inactive"] as const).map((value) => (
                <MenuItem
                  key={value}
                  icon={status === value ? <Check className="size-3.5" /> : undefined}
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
                  size="sm"
                  variant="ghost"
                  icon={<ArrowDownAZ className="size-4" />}
                  label={t("web.workflow_ui.types_settings.sort")}
                />
              }
            />
            <ActionMenuContent>
              <MenuItem
                selected={!descending}
                label={t("web.workflow_ui.sort_name")}
                onClick={() => setDescending(false)}
              />
              <MenuItem
                selected={descending}
                label={t("web.workflow_ui.sort_name_desc")}
                onClick={() => setDescending(true)}
              />
            </ActionMenuContent>
          </Menu>
          {canManage && (
            <Button
              stretch="auto"
              size="sm"
              variant="primary"
              label={t(`${key}.add`)}
              onClick={() => edit({ name: "", description: "" })}
            />
          )}
        </div>
      </div>
      <div className="overflow-x-auto rounded-md">
        <table className="w-full text-left text-body-xs-regular">
          <thead className="h-10 bg-layer-1 text-caption-md-semibold text-tertiary">
            <tr>
              <th scope="col" className="px-3 py-2">
                {t("web.workflow_ui.issue_types")}
              </th>
              <th scope="col" className="px-3 py-2">
                {t("web.workflow_ui.columns.status")}
              </th>
              <th scope="col" className="px-3 py-2">
                {t(`${key}.property_count`)}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {rows.map((type) => (
              <tr key={type.id} className="h-12">
                <td className="px-3 py-2">
                  <Link to={`${base}types/${type.id}/properties/`} className="flex items-center gap-3 text-primary">
                    {logo(type)}
                    <span>{type.name}</span>
                    {badge(type)}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  {t(type.is_active ? "web.workflow_ui.active" : "web.workflow_ui.inactive")}
                </td>
                <td className="px-3 py-2 text-secondary">
                  <div className="flex items-center justify-between gap-3">
                    <span>{type.properties_count ?? "—"}</span>
                    <TypesActions
                      type={type}
                      canManage={canManage}
                      busy={busy}
                      onEdit={edit}
                      onSave={onSave}
                      onPreview={onPreview}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="py-8 text-center text-body-xs-regular text-secondary">{t(`${key}.empty`)}</p>}
      </div>
    </>
  );
}
