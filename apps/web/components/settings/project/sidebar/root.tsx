/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { ScrollArea } from "@makeplane/propel/components/scroll-area";
import sidebarStyles from "@/components/sidebar/sidebar-layout.module.css";
// local imports
import { ProjectSettingsSidebarHeader } from "./header";
import { ProjectSettingsSidebarItemCategories } from "./item-categories";

type Props = {
  projectId: string;
};

export function ProjectSettingsSidebarRoot(props: Props) {
  const { projectId } = props;

  return (
    <div
      className={`flex h-full w-[250px] shrink-0 flex-col overflow-hidden border-r border-r-subtle bg-surface-1 ${sidebarStyles.enter}`}
    >
      <ScrollArea orientation="vertical">
        <div className="pb-5">
          <ProjectSettingsSidebarHeader projectId={projectId} />
          <ProjectSettingsSidebarItemCategories projectId={projectId} />
        </div>
      </ScrollArea>
    </div>
  );
}
