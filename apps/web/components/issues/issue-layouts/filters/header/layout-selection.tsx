/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { ISSUE_LAYOUTS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { EIssueLayoutTypes } from "@plane/types";
import { Tabs, TabsList, Tab } from "@makeplane/propel/components/tabs";
// components
import { IssueLayoutIcon } from "@/components/issues/issue-layouts/layout-icon";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";

type Props = {
  layouts: EIssueLayoutTypes[];
  onChange: (layout: EIssueLayoutTypes) => void;
  selectedLayout: EIssueLayoutTypes | undefined;
};

export function LayoutSelection(props: Props) {
  const { layouts, onChange, selectedLayout } = props;
  const { isMobile } = usePlatformOS();
  const { t } = useTranslation();
  return (
    <Tabs
      variant="contained"
      value={selectedLayout ?? null}
      onValueChange={(value) => {
        const layout = layouts.find((candidate) => candidate === value);
        if (layout && layout !== selectedLayout) onChange(layout);
      }}
    >
      <TabsList aria-label={t("common.layout")}>
        {ISSUE_LAYOUTS.filter((layout) => layouts.includes(layout.key)).map((layout) => (
          <Tooltip key={layout.key} label={t(layout.i18n_title)} disabled={isMobile}>
            <Tab
              value={layout.key}
              label=""
              aria-label={t(layout.i18n_title)}
              data-testid={`layout-switch-${layout.key}`}
              icon={<IssueLayoutIcon layout={layout.key} size={16} className="size-4" />}
            />
          </Tooltip>
        ))}
      </TabsList>
    </Tabs>
  );
}
