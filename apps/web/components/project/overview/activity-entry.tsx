/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import { Avatar } from "@makeplane/propel/components/avatar";
import {
  ActivityOutline,
  AttachOutline,
  DueDateOutline,
  ImageOutline,
  LabelsOutline,
  LinkOutline,
  MembersOutline,
  PriorityOutline,
  ReactionOutline,
  StartDateOutline,
  StateOutline,
  TextOutline,
  UpdatesOutline,
  UserCircleOutline,
} from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
import type { TProjectOverviewActivity } from "@plane/types";
import { calculateTimeAgo, getFileURL, renderFormattedDate, renderFormattedTime } from "@plane/utils";
import { activityFields, overviewActorName, overviewTranslationKey as key } from "./activity-values";

const fieldIcons = {
  name: TextOutline,
  description: TextOutline,
  description_text: TextOutline,
  description_html: TextOutline,
  status: StateOutline,
  priority: PriorityOutline,
  project_lead: UserCircleOutline,
  default_assignee: UserCircleOutline,
  members: MembersOutline,
  labels: LabelsOutline,
  start_date: StartDateOutline,
  target_date: DueDateOutline,
  cover_image: ImageOutline,
  cover_image_asset: ImageOutline,
  logo_props: ImageOutline,
  emoji: ReactionOutline,
  icon_prop: ImageOutline,
  link: LinkOutline,
  update: UpdatesOutline,
  attachment: AttachOutline,
  reaction: ReactionOutline,
};

export function ProjectActivityEntry({
  entry,
  workspaceSlug,
  first,
  last,
  onSelect,
}: {
  entry: TProjectOverviewActivity;
  workspaceSlug: string;
  first: boolean;
  last: boolean;
  onSelect: (entry: TProjectOverviewActivity) => void;
}) {
  const { t } = useTranslation();
  const field = activityFields.has(entry.field) ? t(`${key}.activity_fields.${entry.field}`) : entry.field;
  const verbKey = {
    added: "activity_added",
    created: "activity_added",
    updated: "activity_updated",
    deleted: "activity_deleted",
  }[entry.verb];
  const action = verbKey ? t(`${key}.${verbKey}`, { field }) : `${field} · ${entry.verb}`;
  const Icon = fieldIcons[entry.field as keyof typeof fieldIcons] ?? ActivityOutline;
  const actorName = overviewActorName(entry.actor_detail, t("unknown_user"));
  return (
    <li
      className={`relative flex items-start gap-2 text-caption-sm-regular ${first ? "" : "pt-3"} ${last ? "" : "pb-3"}`}
    >
      {!(first && last) && (
        <span
          aria-hidden="true"
          className={`absolute left-[13px] w-px bg-layer-3 ${first ? "top-4 bottom-0" : last ? "top-0 h-7" : "inset-y-0"}`}
        />
      )}
      <span
        aria-hidden="true"
        className="relative z-1 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-subtle bg-layer-2 text-secondary shadow-raised-100"
      >
        <Icon className="size-3.5 shrink-0" />
      </span>
      <div className="min-w-0 flex-1 text-secondary">
        <p className="line-clamp-2 break-words">
          <span aria-hidden="true" className="mr-1 inline-flex align-middle">
            <Avatar size="2xs" src={getFileURL(entry.actor_detail?.avatar_url ?? "")} alt={actorName} />
          </span>
          {entry.actor ? (
            <Link
              href={`/${workspaceSlug}/profile/${entry.actor}/`}
              className="font-medium text-primary hover:underline"
            >
              {actorName}
            </Link>
          ) : (
            <span className="font-medium text-primary">{actorName}</span>
          )}{" "}
          {action}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <time
            dateTime={entry.created_at}
            title={`${renderFormattedDate(entry.created_at)} ${renderFormattedTime(entry.created_at)}`}
            className="font-medium whitespace-nowrap text-tertiary"
          >
            {calculateTimeAgo(entry.created_at)}
          </time>
          <button
            type="button"
            className="rounded-sm text-tertiary outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-accent-strong"
            onClick={() => onSelect(entry)}
          >
            {t(`${key}.view_changes`)}
          </button>
        </div>
      </div>
    </li>
  );
}
