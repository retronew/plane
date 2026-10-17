import { useState } from "react";
import { observer } from "mobx-react";
import { Avatar } from "@makeplane/propel/components/avatar";
import { InputField } from "@makeplane/propel/components/input-field";
import {
  MenuCheckboxItem,
  MenuSubmenu,
  MenuSubmenuContent,
  MenuSubmenuTrigger,
} from "@makeplane/propel/components/menu";
import { SearchOutline } from "@makeplane/propel/icons";
import { DATE_BEFORE_FILTER_OPTIONS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { TPageFilters } from "@plane/types";
import { getFileURL, isInDateFormat } from "@plane/utils";
import { FilterFieldIcon } from "@/components/common/filters/field-icon";
import { DateFilterModal } from "@/components/core/filters/date-filter-modal";
import { useMember } from "@/hooks/store/use-member";
import { useLabel } from "@/hooks/store/use-label";

const EMPTY_MEMBER_IDS: string[] = [];

type Props = {
  filters: TPageFilters;
  handleFiltersUpdate: <T extends keyof TPageFilters>(filterKey: T, filterValue: TPageFilters[T]) => void;
  memberIds?: string[];
  projectId: string;
};

export const PageFiltersSelection = observer(function PageFiltersSelection({
  filters,
  handleFiltersUpdate,
  memberIds = EMPTY_MEMBER_IDS,
  projectId,
}: Props) {
  const { t } = useTranslation();
  const { getUserDetails } = useMember();
  const { getProjectLabels } = useLabel();
  const [labelSearch, setLabelSearch] = useState("");
  const labels = (getProjectLabels(projectId) ?? []).filter((label) =>
    label.name.toLocaleLowerCase().includes(labelSearch.trim().toLocaleLowerCase())
  );
  const [search, setSearch] = useState("");
  const [customDateOpen, setCustomDateOpen] = useState(false);
  const applied = filters.filters ?? {};
  const selectedLabels = new Set(applied.labels ?? []);
  const selectedCreators = new Set(applied.created_by);
  const customDates = (applied.created_at ?? []).filter((value) => isInDateFormat(value.split(";")[0]));
  const members = memberIds
    .map((id) => getUserDetails(id))
    .filter((member) => member && member.display_name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  const toggleValues = (key: "created_at" | "created_by" | "labels", value: string | string[]) => {
    const current = applied[key] ?? [];
    const values = Array.isArray(value) ? value : [value];
    const next = new Set(current);
    for (const entry of values) {
      if (next.has(entry)) next.delete(entry);
      else next.add(entry);
    }
    handleFiltersUpdate("filters", { ...applied, [key]: [...next] });
  };

  return (
    <div className="w-48 max-w-[calc(100vw-32px)]">
      <MenuCheckboxItem
        icon={<FilterFieldIcon field="favorites" />}
        label={t("web.favorites")}
        checked={!!applied.favorites}
        onCheckedChange={() => handleFiltersUpdate("filters", { ...applied, favorites: !applied.favorites })}
        closeOnClick={false}
      />
      <MenuSubmenu>
        <MenuSubmenuTrigger
          icon={<FilterFieldIcon field="created_at" />}
          label={t("web.created_date")}
          trailing={applied.created_at?.length ? String(applied.created_at.length) : undefined}
        />
        <MenuSubmenuContent>
          {DATE_BEFORE_FILTER_OPTIONS.map((option) => (
            <MenuCheckboxItem
              key={option.value}
              label={option.name}
              checked={applied.created_at?.includes(option.value) ?? false}
              onCheckedChange={() => toggleValues("created_at", option.value)}
              closeOnClick={false}
            />
          ))}
          <MenuCheckboxItem
            label={t("web.custom")}
            checked={customDates.length > 0}
            onCheckedChange={() =>
              customDates.length ? toggleValues("created_at", customDates) : setCustomDateOpen(true)
            }
            closeOnClick={false}
          />
        </MenuSubmenuContent>
      </MenuSubmenu>
      <MenuSubmenu>
        <MenuSubmenuTrigger
          icon={<FilterFieldIcon field="created_by" />}
          label={t("web.created_by")}
          trailing={applied.created_by?.length ? String(applied.created_by.length) : undefined}
        />
        <MenuSubmenuContent>
          <div className="w-56 max-w-[calc(100vw-32px)]">
            <div className="px-1 pb-1">
              <InputField
                size="md"
                orientation="vertical"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
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
                      checked={selectedCreators.has(member.id)}
                      onCheckedChange={() => toggleValues("created_by", member.id)}
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
      <MenuSubmenu>
        <MenuSubmenuTrigger
          icon={<FilterFieldIcon field="labels" />}
          label={t("labels")}
          trailing={applied.labels?.length ? String(applied.labels.length) : undefined}
        />
        <MenuSubmenuContent>
          <div className="w-56 max-w-[calc(100vw-32px)]">
            <div className="px-1 pb-1">
              <InputField
                size="md"
                orientation="vertical"
                value={labelSearch}
                onChange={(event) => setLabelSearch(event.target.value)}
                placeholder={t("search")}
                aria-label={t("search")}
                startIcon={<SearchOutline />}
              />
            </div>
            <div className="max-h-64 overflow-y-auto">
              {labels.map((label) => (
                <MenuCheckboxItem
                  key={label.id}
                  label={label.name}
                  checked={selectedLabels.has(label.id)}
                  onCheckedChange={() => toggleValues("labels", label.id)}
                  closeOnClick={false}
                  icon={<span className="size-2 rounded-full" style={{ backgroundColor: label.color }} />}
                />
              ))}
              {!labels.length && <p className="px-2 py-2 text-12 text-tertiary">{t("web.no_matches_found")}</p>}
            </div>
          </div>
        </MenuSubmenuContent>
      </MenuSubmenu>
      <DateFilterModal
        isOpen={customDateOpen}
        handleClose={() => setCustomDateOpen(false)}
        onSelect={(value) => toggleValues("created_at", value)}
        title={t("web.created_date")}
      />
    </div>
  );
});
