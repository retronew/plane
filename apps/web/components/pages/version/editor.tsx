/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import type { TDisplayConfig } from "@plane/editor";
import type { TPageVersion } from "@plane/types";
// components
import { PageEditorSkeleton } from "@/components/pages/loaders/page-editor-skeleton";
import { DocumentEditor } from "@/components/editor/document/editor";
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";
import { usePageFilters } from "@/hooks/use-page-filters";
// plane web hooks
import type { EPageStoreType } from "@/hooks/store";

export type TVersionEditorProps = {
  activeVersion: string | null;
  versionDetails: TPageVersion | undefined;
  storeType: EPageStoreType;
};

export const PagesVersionEditor = observer(function PagesVersionEditor(props: TVersionEditorProps) {
  const { activeVersion, versionDetails } = props;
  // params
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { getWorkspaceBySlug } = useWorkspace();
  // derived values
  const workspaceDetails = getWorkspaceBySlug(workspaceSlug?.toString() ?? "");
  // page filters
  const { fontSize, fontStyle } = usePageFilters();

  const displayConfig: TDisplayConfig = {
    fontSize,
    fontStyle,
    wideLayout: true,
  };

  if (!versionDetails)
    return (
      <div className="size-full px-5">
        <PageEditorSkeleton />
      </div>
    );

  const description = versionDetails.description_html ?? "<p></p>";

  return (
    <DocumentEditor
      key={activeVersion ?? ""}
      editable={false}
      id={activeVersion ?? ""}
      value={description}
      containerClassName="p-0 pb-64 border-none"
      displayConfig={displayConfig}
      editorClassName="pl-10"
      projectId={projectId?.toString()}
      workspaceId={workspaceDetails?.id ?? ""}
      workspaceSlug={workspaceSlug?.toString() ?? ""}
    />
  );
});
