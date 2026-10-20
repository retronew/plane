/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useLayoutEffect, useState } from "react";
import { Avatar } from "@makeplane/propel/components/avatar";
import { Button } from "@makeplane/propel/components/button";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { useTranslation } from "@plane/i18n";
import type { TProjectOverviewActivity } from "@plane/types";
import { getFileURL, renderFormattedDate, renderFormattedTime } from "@plane/utils";
import { activityFields, activityValue, overviewActorName, overviewTranslationKey as key } from "./activity-values";

export function ProjectActivityDetailDialog({
  entry,
  open,
  onClose,
  onOpenChangeComplete,
}: {
  entry: TProjectOverviewActivity;
  open: boolean;
  onClose: () => void;
  onOpenChangeComplete: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  // Base UI needs a closed commit before opening a conditionally mounted dialog to animate entry.
  const [mounted, setMounted] = useState(false);
  useLayoutEffect(() => {
    // Synchronize Base UI's enter transition before paint.
    // eslint-disable-next-line react/set-state-in-effect, react-doctor/no-initialize-state
    setMounted(true);
  }, []);
  const field = activityFields.has(entry.field) ? t(`${key}.activity_fields.${entry.field}`) : entry.field;
  return (
    <Dialog
      open={mounted && open}
      onOpenChange={(nextOpen) => !nextOpen && onClose()}
      onOpenChangeComplete={onOpenChangeComplete}
    >
      <DialogContent size="md">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>{t(`${key}.change_details`)}</DialogTitle>
            </DialogHeading>
          </DialogHeader>
          <DialogBody tabIndex={0}>
            <div className="space-y-5">
              <div className="space-y-1 text-13 text-secondary">
                <p className="flex items-center gap-1.5 font-medium text-primary">
                  <span aria-hidden="true" className="inline-flex shrink-0">
                    <Avatar
                      size="2xs"
                      src={getFileURL(entry.actor_detail?.avatar_url ?? "")}
                      alt={overviewActorName(entry.actor_detail, t("unknown_user"))}
                    />
                  </span>
                  {overviewActorName(entry.actor_detail, t("unknown_user"))} · {field}
                </p>
                <time dateTime={entry.created_at} className="text-tertiary">
                  {renderFormattedDate(entry.created_at)} {renderFormattedTime(entry.created_at)}
                </time>
              </div>
              <dl className="space-y-4 text-13 break-words whitespace-pre-wrap">
                <div>
                  <dt className="mb-2 font-medium text-secondary">{t(`${key}.activity_old_value`)}</dt>
                  <dd className="max-h-64 overflow-y-auto rounded-xl border border-subtle bg-layer-1 p-3 text-primary">
                    {activityValue(entry.old_value)}
                  </dd>
                </div>
                <div>
                  <dt className="mb-2 font-medium text-secondary">{t(`${key}.activity_new_value`)}</dt>
                  <dd className="max-h-64 overflow-y-auto rounded-xl border border-subtle bg-layer-1 p-3 text-primary">
                    {activityValue(entry.new_value)}
                  </dd>
                </div>
              </dl>
            </div>
          </DialogBody>
        </DialogMain>
        <DialogActions>
          <Button variant="secondary" size="md" stretch="auto" label={t("close")} onClick={onClose} />
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
