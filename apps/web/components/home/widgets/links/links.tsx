/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { SortableProvider, SortableItem } from "@plane/blocks/sortable";
import type { SortableChange } from "@plane/blocks/sortable";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
// computed
import { ContentOverflowWrapper } from "@/components/core/content-overflow-HOC";
import { useHome } from "@/hooks/store/use-home";
import { LinksEmptyState } from "../empty-states/links";
import { EWidgetKeys, WidgetLoader } from "../loaders";
import { ProjectLinkDetail } from "./link-detail";
import type { TLinkOperations } from "./use-links";

export type TLinkOperationsModal = Exclude<TLinkOperations, "create">;

export type TProjectLinkList = {
  linkOperations: TLinkOperationsModal;
  workspaceSlug: string;
};

export const ProjectLinkList = observer(function ProjectLinkList(props: TProjectLinkList) {
  // props
  const { linkOperations, workspaceSlug } = props;
  // hooks
  const {
    quickLinks: { getLinksByWorkspaceId, reorderLink, isReorderingLinks },
  } = useHome();

  const { t } = useTranslation();
  const links = getLinksByWorkspaceId(workspaceSlug);
  const group = `quick-links:${workspaceSlug}`;
  const isSaving = isReorderingLinks[workspaceSlug] ?? false;
  const handleSortEnd = async (change: SortableChange) => {
    if (change.group !== group || change.initialGroup !== group) return;
    try {
      await reorderLink(workspaceSlug, change.id, change.index);
    } catch (error) {
      setToast({ type: "error", title: t("error"), message: t("something_went_wrong") });
      throw error;
    }
  };

  if (links === undefined) return <WidgetLoader widgetKey={EWidgetKeys.QUICK_LINKS} />;

  if (links.length === 0) return <LinksEmptyState />;

  return (
    <div className="relative w-full">
      <ContentOverflowWrapper
        maxHeight={150}
        containerClassName="box-border w-full min-w-0 min-h-[30px] flex flex-col"
        fallback={<></>}
        buttonClassName="bg-surface-2/20"
      >
        <SortableProvider key={workspaceSlug} disabled={isSaving} onSortEnd={handleSortEnd}>
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {links.map((linkId, index) => (
              <SortableItem
                key={linkId}
                id={linkId}
                index={index}
                group={group}
                activation="row"
                disabled={isSaving}
                className="w-full min-w-0"
              >
                {({ handleRef }) => (
                  <ProjectLinkDetail linkId={linkId} linkOperations={linkOperations} sortableRef={handleRef} />
                )}
              </SortableItem>
            ))}
          </div>
        </SortableProvider>
      </ContentOverflowWrapper>
    </div>
  );
});
