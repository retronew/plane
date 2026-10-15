/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { translate } from "@plane/i18n";
import { observer } from "mobx-react";
// components
import { PageHead } from "@/components/core/page-title";
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";
// local imports
import { WorkspaceActiveCycles } from "@/components/active-cycles/root";

function WorkspaceActiveCyclesPage() {
  const { currentWorkspace } = useWorkspace();
  // derived values
  const pageTitle = currentWorkspace?.name
    ? translate("web.runtime.page_title", {
        name: currentWorkspace?.name,
        section: translate("web.title_active_cycles"),
      })
    : undefined;

  return (
    <>
      <PageHead title={pageTitle} />
      <WorkspaceActiveCycles />
    </>
  );
}

export default observer(WorkspaceActiveCyclesPage);
