/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { CHART_STATE_COLORS, STATE_GROUPS } from "@plane/constants";
// types
import { useTranslation } from "@plane/i18n";
import type { IUserStateDistribution } from "@plane/types";
import { Card } from "@plane/blocks/card";
// constants

type Props = {
  stateDistribution: IUserStateDistribution[];
};

export function ProfileWorkload({ stateDistribution }: Props) {
  const { t } = useTranslation();

  return (
    <div className="@container space-y-2">
      <h3 className="text-h6-medium">{t("profile.stats.workload")}</h3>
      <div className="grid grid-cols-2 gap-3 @sm:grid-cols-3 @[40rem]:grid-cols-5">
        {stateDistribution.map((group) => (
          <Card key={group.state_group} className="min-w-0 space-y-1 rounded-xl border border-subtle-1 bg-layer-2 p-3">
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className="size-2.5 shrink-0 rounded-xs"
                style={{ backgroundColor: CHART_STATE_COLORS[group.state_group] }}
              />
              <p className="truncate text-body-xs-regular text-secondary">
                {group.state_group === "unstarted"
                  ? t("web.not_started")
                  : group.state_group === "started"
                    ? t("web.working_on")
                    : STATE_GROUPS[group.state_group].label}
              </p>
            </div>
            <p className="text-h5-semibold">{group.state_count}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
