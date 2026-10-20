import type { ReactNode } from "react";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
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
  layoutOverrides?: Partial<Record<EIssueLayoutTypes, { label: string; icon: ReactNode }>>;
  layouts: EIssueLayoutTypes[];
  onChange: (layout: EIssueLayoutTypes) => void;
  selectedLayout: EIssueLayoutTypes | undefined;
};

export function LayoutSelection(props: Props) {
  const { layouts, onChange, selectedLayout, layoutOverrides } = props;
  const { isMobile } = usePlatformOS();
  const { t } = useTranslation();
  const layoutsSet = useMemo(() => new Set(layouts), [layouts]);
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
        {ISSUE_LAYOUTS.filter((layout) => layoutsSet.has(layout.key)).map((layout) => (
          <Tooltip
            key={layout.key}
            label={layoutOverrides?.[layout.key]?.label ?? t(layout.i18n_title)}
            disabled={isMobile}
          >
            <Tab
              value={layout.key}
              label=""
              aria-label={layoutOverrides?.[layout.key]?.label ?? t(layout.i18n_title)}
              data-testid={`layout-switch-${layout.key}`}
              icon={
                layoutOverrides?.[layout.key]?.icon ?? (
                  <IssueLayoutIcon layout={layout.key} size={16} className="size-4" />
                )
              }
            />
          </Tooltip>
        ))}
      </TabsList>
    </Tabs>
  );
}
