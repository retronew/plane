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
import { PriorityIcon } from "@plane/blocks/icons";
import { INBOX_STATUS, ISSUE_PRIORITIES, PAST_DURATION_FILTER_OPTIONS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { TInboxIssueFilter, TInboxIssueFilterDateKeys } from "@plane/types";
import { getFileURL, isInDateFormat } from "@plane/utils";
import { FilterFieldIcon } from "@/components/common/filters/field-icon";
import { DateFilterModal } from "@/components/core/filters/date-filter-modal";
import { useLabel } from "@/hooks/store/use-label";
import { useMember } from "@/hooks/store/use-member";
import { useProjectInbox } from "@/hooks/store/use-project-inbox";
import { InboxStatusIcon } from "../../inbox-status-icon";

export const InboxIssueFilterSelection = observer(function InboxIssueFilterSelection() {
  const { t } = useTranslation();
  const { currentTab, inboxFilters, handleInboxIssueFilters } = useProjectInbox();
  const {
    project: { projectMemberIds },
    getUserDetails,
  } = useMember();
  const { projectLabels } = useLabel();
  const [searches, setSearches] = useState<Record<string, string>>({});
  const [dateModal, setDateModal] = useState<TInboxIssueFilterDateKeys | null>(null);
  const filters = inboxFilters ?? {};
  const selectedStatuses = new Set(filters.status ?? []);
  const toggle = <T extends keyof TInboxIssueFilter>(key: T, value: NonNullable<TInboxIssueFilter[T]>[number]) => {
    const selected = new Set<string | number>(filters[key] ?? []);
    if (selected.has(value)) selected.delete(value);
    else selected.add(value);
    if (key === "status" && !selected.size) return;
    handleInboxIssueFilters(key, [...selected] as TInboxIssueFilter[T]);
  };
  const labels: Record<string, string> = {
    status: t("web.runtime.filter_work_item_status", { count: 0 }),
    priority: t("priority"),
    assignees: t("web.assignees"),
    created_by: t("web.created_by"),
    labels: t("labels"),
    created_at: t("web.created_date"),
    updated_at: t("web.last_updated_date"),
  };
  const searchInput = (key: string) => (
    <div className="px-1 pb-1">
      <InputField
        size="md"
        orientation="vertical"
        value={searches[key] ?? ""}
        onChange={(event) => setSearches((previous) => ({ ...previous, [key]: event.target.value }))}
        placeholder={t("search")}
        aria-label={t("search")}
        startIcon={<SearchOutline />}
      />
    </div>
  );
  const matches = (key: string, name: string) =>
    name.toLocaleLowerCase().includes((searches[key] ?? "").trim().toLocaleLowerCase());
  return (
    <div className="w-48 max-w-[calc(100vw-32px)]">
      <MenuSubmenu>
        <MenuSubmenuTrigger
          icon={<FilterFieldIcon field="status" />}
          label={labels.status}
          trailing={String(filters.status?.length ?? 0)}
        />
        <MenuSubmenuContent>
          {INBOX_STATUS.filter((status) =>
            currentTab === "open" ? [-2, 0].includes(status.status) : [-1, 1, 2].includes(status.status)
          ).map((status) => (
            <MenuCheckboxItem
              key={status.key}
              label={t(status.i18n_title)}
              icon={<InboxStatusIcon type={status.status} className="size-3.5" />}
              checked={selectedStatuses.has(status.status)}
              onCheckedChange={() => toggle("status", status.status)}
              closeOnClick={false}
            />
          ))}
        </MenuSubmenuContent>
      </MenuSubmenu>
      <MenuSubmenu>
        <MenuSubmenuTrigger
          icon={<FilterFieldIcon field="priority" />}
          label={labels.priority}
          trailing={filters.priority?.length ? String(filters.priority.length) : undefined}
        />
        <MenuSubmenuContent>
          {ISSUE_PRIORITIES.map((priority) => (
            <MenuCheckboxItem
              key={priority.key}
              label={priority.title}
              icon={<PriorityIcon priority={priority.key} className="size-3.5" />}
              checked={filters.priority?.includes(priority.key) ?? false}
              onCheckedChange={() => toggle("priority", priority.key)}
              closeOnClick={false}
            />
          ))}
        </MenuSubmenuContent>
      </MenuSubmenu>
      {(["assignees", "created_by", "labels"] as const).map((key) => {
        const selected = new Set(filters[key] ?? []);
        const options =
          key === "labels"
            ? (projectLabels ?? []).map((label) => ({
                id: label.id,
                name: label.name,
                icon: <span className="size-2 rounded-full" style={{ background: label.color }} />,
              }))
            : (projectMemberIds ?? [])
                .map((id) => getUserDetails(id))
                .filter((member) => !!member)
                .map((member) => ({
                  id: member.id,
                  name: member.display_name,
                  icon: (
                    <Avatar
                      size="xs"
                      alt={member.display_name}
                      src={getFileURL(member.avatar_url)}
                      fallback={member.display_name[0]}
                    />
                  ),
                }));
        const visible = options.filter((option) => matches(key, option.name));
        return (
          <MenuSubmenu key={key}>
            <MenuSubmenuTrigger
              icon={<FilterFieldIcon field={key} />}
              label={labels[key]}
              trailing={selected.size ? String(selected.size) : undefined}
            />
            <MenuSubmenuContent>
              <div className="w-56 max-w-[calc(100vw-32px)]">
                {searchInput(key)}
                <div className="max-h-64 overflow-y-auto">
                  {visible.map((option) => (
                    <MenuCheckboxItem
                      key={option.id}
                      label={option.name}
                      icon={option.icon}
                      checked={selected.has(option.id)}
                      onCheckedChange={() => toggle(key, option.id)}
                      closeOnClick={false}
                    />
                  ))}
                  {!visible.length && <p className="px-2 py-2 text-12 text-tertiary">{t("web.no_matches_found")}</p>}
                </div>
              </div>
            </MenuSubmenuContent>
          </MenuSubmenu>
        );
      })}
      {(["created_at", "updated_at"] as const).map((key) => {
        const selected = filters[key] ?? [];
        const custom = new Set(selected.filter((value) => isInDateFormat(value.split(";")[0])));
        return (
          <MenuSubmenu key={key}>
            <MenuSubmenuTrigger
              icon={<FilterFieldIcon field={key} />}
              label={labels[key]}
              trailing={selected.length ? String(selected.length) : undefined}
            />
            <MenuSubmenuContent>
              {PAST_DURATION_FILTER_OPTIONS.map((option) => (
                <MenuCheckboxItem
                  key={option.value}
                  label={option.name}
                  checked={selected.includes(option.value)}
                  onCheckedChange={() =>
                    handleInboxIssueFilters(key, selected.includes(option.value) ? [] : [option.value])
                  }
                  closeOnClick={false}
                />
              ))}
              <MenuCheckboxItem
                label={t("web.custom")}
                checked={custom.size > 0}
                onCheckedChange={() =>
                  custom.size
                    ? handleInboxIssueFilters(
                        key,
                        selected.filter((value) => !custom.has(value))
                      )
                    : setDateModal(key)
                }
                closeOnClick={false}
              />
            </MenuSubmenuContent>
          </MenuSubmenu>
        );
      })}
      <DateFilterModal
        isOpen={dateModal !== null}
        handleClose={() => setDateModal(null)}
        title={labels[dateModal ?? "created_at"]}
        onSelect={(value) => {
          if (dateModal) handleInboxIssueFilters(dateModal, value);
        }}
      />
    </div>
  );
});
