import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import {
  MenuCheckboxItem,
  MenuItem,
  MenuSubmenu,
  MenuSubmenuContent,
  MenuSubmenuTrigger,
} from "@makeplane/propel/components/menu";
import { InputField } from "@makeplane/propel/components/input-field";
import { SearchOutline } from "@makeplane/propel/icons";
import { Avatar } from "@makeplane/propel/components/avatar";
import { NETWORK_CHOICES, PROJECT_CREATED_AT_FILTER_OPTIONS, ISSUE_PRIORITIES } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { TProjectDisplayFilters, TProjectFilters } from "@plane/types";
import { getFileURL, isInDateFormat } from "@plane/utils";
import { DateFilterModal } from "@/components/core/filters/date-filter-modal";
import { useMember } from "@/hooks/store/use-member";
import { useProjectCategories } from "@/components/settings/workspace/configuration/project-fields";
import { ProjectNetworkIcon } from "../../project-network-icon";
import { ProjectStatusIcon } from "../../project-status-icon";

const EMPTY_MEMBER_IDS: string[] = [];

type Props = {
  displayFilters: TProjectDisplayFilters;
  filters: TProjectFilters;
  handleFiltersUpdate: (key: keyof TProjectFilters, value: string | string[]) => void;
  handleDisplayFiltersUpdate: (updated: Partial<TProjectDisplayFilters>) => void;
  memberIds?: string[];
};

function MemberFilter({
  label,
  ids,
  selected,
  onChange,
}: {
  label: string;
  ids: string[];
  selected: string[];
  onChange: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const { getUserDetails } = useMember();
  const { t } = useTranslation();
  const members = ids
    .map((id) => getUserDetails(id))
    .filter((member) => member && member.display_name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return (
    <MenuSubmenu>
      <MenuSubmenuTrigger label={label} trailing={selected.length ? String(selected.length) : undefined} />
      <MenuSubmenuContent>
        <div className="w-56 max-w-[calc(100vw-32px)]">
          <div className="px-1 pb-1">
            <InputField
              size="md"
              orientation="vertical"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search")}
              aria-label={t("search")}
              startIcon={<SearchOutline />}
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {members.map(
              (member) =>
                member && (
                  <MenuCheckboxItem
                    key={member.id}
                    label={member.display_name}
                    checked={selected.includes(member.id)}
                    onCheckedChange={() => onChange(member.id)}
                    closeOnClick={false}
                    icon={
                      <Avatar
                        size="xs"
                        alt={member.display_name}
                        src={getFileURL(member.avatar_url)}
                        fallback={member.display_name[0]}
                      />
                    }
                  />
                )
            )}
            {!members.length && <p className="px-2 py-2 text-12 text-tertiary">{t("web.no_matches_found")}</p>}
          </div>
        </div>
      </MenuSubmenuContent>
    </MenuSubmenu>
  );
}

export const ProjectFiltersSelection = observer(function ProjectFiltersSelection({
  filters,
  handleFiltersUpdate,
  memberIds = EMPTY_MEMBER_IDS,
}: Props) {
  const { workspaceSlug } = useParams();
  const { t } = useTranslation();
  const categories = useProjectCategories(String(workspaceSlug));
  const [customDateOpen, setCustomDateOpen] = useState(false);
  const customSelected = (filters.created_at ?? []).filter((value) => isInDateFormat(value.split(";")[0]));
  return (
    <div className="w-48 max-w-[calc(100vw-32px)]">
      <MenuSubmenu>
        <MenuSubmenuTrigger label={t("web.project_page.access")} />
        <MenuSubmenuContent>
          {NETWORK_CHOICES.map((choice) => (
            <MenuCheckboxItem
              key={choice.key}
              label={t(choice.i18n_label)}
              icon={<ProjectNetworkIcon iconKey={choice.iconKey} />}
              checked={filters.access?.includes(String(choice.key)) ?? false}
              onCheckedChange={() => handleFiltersUpdate("access", String(choice.key))}
              closeOnClick={false}
            />
          ))}
        </MenuSubmenuContent>
      </MenuSubmenu>
      <MenuSubmenu>
        <MenuSubmenuTrigger label={t("priority")} />
        <MenuSubmenuContent>
          {ISSUE_PRIORITIES.map((choice) => (
            <MenuCheckboxItem
              key={choice.key}
              label={choice.title}
              checked={filters.priority?.includes(choice.key) ?? false}
              onCheckedChange={() => handleFiltersUpdate("priority", choice.key)}
              closeOnClick={false}
            />
          ))}
        </MenuSubmenuContent>
      </MenuSubmenu>
      {(["status", "labels"] as const)
        .filter((key) => key !== "status" || categories.statesEnabled)
        .map((key) => (
          <MenuSubmenu key={key}>
            <MenuSubmenuTrigger label={t(key === "status" ? "web.project_statuses" : "web.project_labels")} />
            <MenuSubmenuContent>
              <div className="max-h-64 min-w-36 overflow-y-auto">
                {(key === "status" ? categories.statuses : categories.labels).map((entry) => (
                  <MenuCheckboxItem
                    key={entry.id}
                    label={entry.name}
                    checked={filters[key]?.includes(entry.id) ?? false}
                    onCheckedChange={() => handleFiltersUpdate(key, entry.id)}
                    closeOnClick={false}
                    icon={
                      key === "status" ? (
                        <ProjectStatusIcon group={entry.group} color={entry.color} />
                      ) : (
                        <span className="size-2 rounded-full" style={{ background: entry.color }} />
                      )
                    }
                  />
                ))}
                {!(key === "status" ? categories.statuses : categories.labels).length && (
                  <p className="px-2 py-2 text-12 text-tertiary">{t("web.configuration_empty")}</p>
                )}
              </div>
            </MenuSubmenuContent>
          </MenuSubmenu>
        ))}
      <MemberFilter
        label={t("lead")}
        ids={memberIds}
        selected={filters.lead ?? []}
        onChange={(id) => handleFiltersUpdate("lead", id)}
      />
      <MemberFilter
        label={t("common.members")}
        ids={memberIds}
        selected={filters.members ?? []}
        onChange={(id) => handleFiltersUpdate("members", id)}
      />
      <MenuSubmenu>
        <MenuSubmenuTrigger label={t("web.created_date")} />
        <MenuSubmenuContent>
          {PROJECT_CREATED_AT_FILTER_OPTIONS.map((option) => (
            <MenuCheckboxItem
              key={option.value}
              checked={filters.created_at?.includes(option.value) ?? false}
              label={option.name}
              onCheckedChange={() => handleFiltersUpdate("created_at", option.value)}
              closeOnClick={false}
            />
          ))}
          <MenuItem
            label={t("web.custom")}
            onClick={() =>
              customSelected.length ? handleFiltersUpdate("created_at", customSelected) : setCustomDateOpen(true)
            }
            closeOnClick={false}
          />
        </MenuSubmenuContent>
      </MenuSubmenu>
      <DateFilterModal
        isOpen={customDateOpen}
        handleClose={() => setCustomDateOpen(false)}
        onSelect={(value) => handleFiltersUpdate("created_at", value)}
        title={t("web.created_date")}
      />
    </div>
  );
});
