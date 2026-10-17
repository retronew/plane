import { observer } from "mobx-react";
import { Badge } from "@makeplane/propel/components/badge";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { CalendarOutline, CloseOutline } from "@makeplane/propel/icons";
import { Header, EHeaderVariant } from "@plane/blocks/layout";
import { PriorityIcon } from "@plane/blocks/icons";
import { INBOX_STATUS, ISSUE_PRIORITIES, PAST_DURATION_FILTER_OPTIONS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { TInboxIssueFilter } from "@plane/types";
import { renderFormattedDate } from "@plane/utils";
import { ProjectFilterChip } from "@/components/project/applied-filters/chip";
import { AppliedMembersFilters } from "@/components/project/applied-filters/members";
import { useProjectInbox } from "@/hooks/store/use-project-inbox";
import { useLabel } from "@/hooks/store/use-label";
import { useProjectState } from "@/hooks/store/use-project-state";
import { InboxStatusIcon } from "../../inbox-status-icon";

const GROUP_CLASSNAME =
  "my-auto flex min-h-7 flex-wrap items-center gap-1.5 rounded-md border border-subtle-1 bg-layer-2 px-2 py-0.5 text-11 text-tertiary";
export const InboxIssueAppliedFilters = observer(function InboxIssueAppliedFilters() {
  const { t } = useTranslation();
  const {
    inboxFilters,
    getAppliedFiltersCount,
    handleInboxIssueFilters,
    clearInboxIssueFilters,
    inboxIssuePaginationInfo,
    loader,
  } = useProjectInbox();
  const { projectLabels } = useLabel();
  const { getStateById } = useProjectState();
  const labels = new Map((projectLabels ?? []).map((label) => [label.id, label]));
  if (!getAppliedFiltersCount) return null;
  const titles: Record<keyof TInboxIssueFilter, string> = {
    status: t("web.runtime.filter_work_item_status", { count: 0 }),
    state: t("web.state"),
    priority: t("priority"),
    assignees: t("web.assignees"),
    created_by: t("web.created_by"),
    labels: t("labels"),
    created_at: t("web.created_date"),
    updated_at: t("web.last_updated_date"),
  };
  const remove = (key: keyof TInboxIssueFilter, value: string | number) => {
    const next = (inboxFilters[key] as (string | number)[] | undefined)?.filter((entry) => entry !== value) ?? [];
    if (key === "status" && !next.length) return;
    handleInboxIssueFilters(key, next as TInboxIssueFilter[typeof key]);
  };
  const dateLabel = (value: string) => {
    const relative = PAST_DURATION_FILTER_OPTIONS.find((entry) => entry.value === value);
    if (relative) return relative.name;
    const [date, direction] = value.split(";");
    return `${t(direction === "after" ? "web.after" : "web.before")} ${renderFormattedDate(date)}`;
  };
  return (
    <Header variant={EHeaderVariant.TERNARY}>
      <Header.LeftItem>
        {Object.entries(inboxFilters ?? {}).map(([field, values]) => {
          const key = field as keyof TInboxIssueFilter;
          if (!values?.length) return null;
          return (
            <div key={key} className={GROUP_CLASSNAME}>
              <span className="text-11 text-tertiary">{titles[key]}</span>
              <div className="flex flex-wrap items-center gap-1">
                {key === "assignees" || key === "created_by" ? (
                  <AppliedMembersFilters values={values as string[]} editable handleRemove={(id) => remove(key, id)} />
                ) : (
                  values.map((id) => {
                    let label = String(id);
                    let icon;
                    if (key === "status") {
                      const status = INBOX_STATUS.find((entry) => entry.status === id);
                      label = status ? t(status.i18n_title) : label;
                      icon = status ? <InboxStatusIcon type={status.status} className="size-3" /> : undefined;
                    } else if (key === "priority") {
                      const priority = ISSUE_PRIORITIES.find((entry) => entry.key === id);
                      label = priority?.title ?? label;
                      icon = priority ? <PriorityIcon priority={priority.key} className="size-3" /> : undefined;
                    } else if (key === "labels") {
                      const entry = labels.get(String(id));
                      label = entry?.name ?? t("web.configuration_deleted_filter");
                      icon = entry ? (
                        <span className="size-2 rounded-full" style={{ background: entry.color }} />
                      ) : undefined;
                    } else if (key === "state") {
                      const state = getStateById(String(id));
                      label = state?.name ?? label;
                      icon = state ? (
                        <span className="size-2 rounded-full" style={{ background: state.color }} />
                      ) : undefined;
                    } else {
                      label = dateLabel(String(id));
                      icon = <CalendarOutline className="size-3" />;
                    }
                    return (
                      <ProjectFilterChip
                        key={id}
                        label={label}
                        icon={icon}
                        onRemove={key === "status" && values.length === 1 ? undefined : () => remove(key, id)}
                      />
                    );
                  })
                )}
                {key !== "status" && (
                  <IconButton
                    variant="ghost"
                    size="xs"
                    icon={<CloseOutline />}
                    aria-label={`${t("remove")} ${titles[key]}`}
                    onClick={() => handleInboxIssueFilters(key, undefined)}
                  />
                )}
              </div>
            </div>
          );
        })}
        <Button
          variant="secondary"
          size="md"
          stretch="auto"
          label={t("common.clear_all")}
          onClick={clearInboxIssueFilters}
        />
      </Header.LeftItem>
      {inboxIssuePaginationInfo && loader !== "filter-loading" && (
        <Header.RightItem>
          <Tooltip
            label={t("web.runtime.matching_intake_items", { count: inboxIssuePaginationInfo.total_results })}
            layout="stacked"
          >
            <Badge size="sm" variant="neutral" label={String(inboxIssuePaginationInfo.total_results)} />
          </Tooltip>
        </Header.RightItem>
      )}
    </Header>
  );
});
