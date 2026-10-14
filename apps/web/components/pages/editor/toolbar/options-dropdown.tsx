/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import { observer } from "mobx-react";
import { HistoryOutline } from "@makeplane/propel/icons";
import { Download, Copy, Maximize2, Pin, Type, FileText, Code2 } from "lucide-react";
import { copyPageContent } from "./copy-content";
// plane imports
import { setToast } from "@plane/blocks/toast";
import { Switch } from "@makeplane/propel/components/switch";
// hooks
import { useAppRouter } from "@/hooks/use-app-router";
import { usePageFilters } from "@/hooks/use-page-filters";
import { useQueryParams } from "@/hooks/use-query-params";
// plane web imports
import type { TPageNavigationPaneTab } from "@/components/pages/navigation-pane/tab-panels";
import type { EPageStoreType } from "@/hooks/store";
// store
import type { TPageInstance } from "@/store/pages/base-page";
// local imports
import { PageActions } from "../../dropdowns";
import { ExportPageModal } from "../../modals/export-page-modal";
import { PAGE_NAVIGATION_PANE_TABS_QUERY_PARAM } from "../../navigation-pane";
import { translate } from "@plane/i18n";

type Props = {
  page: TPageInstance;
  storeType: EPageStoreType;
};

export const PageOptionsDropdown = observer(function PageOptionsDropdown(props: Props) {
  const { page, storeType } = props;
  // states
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  // navigation
  const router = useAppRouter();
  // store values
  const {
    name,
    isContentEditable,
    editor: { editorRef },
  } = page;
  // page filters
  const { isFullWidth, handleFullWidth, isStickyToolbarEnabled, handleStickyToolbar } = usePageFilters();
  // query params
  const { updateQueryParams } = useQueryParams();
  // menu items list
  const EXTRA_MENU_OPTIONS = useMemo(
    function getExtraMenuOptions(): React.ComponentProps<typeof PageActions>["extraOptions"] {
      return [
        {
          key: "full-screen",
          closeOnClick: false,
          action: () => handleFullWidth(!isFullWidth),
          title: translate("web.full_width"),
          icon: Maximize2,
          // The row itself does the toggling; the switch is the state readout at the row's end.
          customContent: (
            <span className="pointer-events-none">
              <Switch size="md" checked={isFullWidth} aria-hidden tabIndex={-1} />
            </span>
          ),
        },
        {
          key: "sticky-toolbar",
          closeOnClick: false,
          action: () => handleStickyToolbar(!isStickyToolbarEnabled),
          title: translate("web.sticky_toolbar"),
          icon: Pin,
          customContent: (
            <span className="pointer-events-none">
              <Switch size="md" checked={isStickyToolbarEnabled} aria-hidden tabIndex={-1} />
            </span>
          ),
          shouldRender: isContentEditable,
        },
        {
          key: "copy-markdown",
          action: () => {},
          title: translate("web.copy_as"),
          icon: Copy,
          disabled: !editorRef,
          nestedMenuItems: [
            { key: "text", title: translate("web.plain_text"), icon: Type },
            { key: "markdown", title: "Markdown", icon: FileText },
            { key: "html", title: "HTML", icon: Code2 },
          ].map(({ key, title, icon }) => ({
            key,
            title,
            icon,
            action: () => {
              if (!editorRef) return;
              void copyPageContent(editorRef, key as "text" | "markdown" | "html").then(
                () =>
                  setToast({
                    type: "success",
                    title: translate("toast.success"),
                    message: translate("web.page_content_copied"),
                  }),
                () =>
                  setToast({
                    type: "error",
                    title: translate("toast.error"),
                    message: translate("web.page_copy_failed"),
                  })
              );
            },
          })),
          shouldRender: true,
        },
        {
          key: "version-history",
          action: () => {
            // update query param to show info tab in navigation pane
            const updatedRoute = updateQueryParams({
              paramsToAdd: {
                [PAGE_NAVIGATION_PANE_TABS_QUERY_PARAM]: "info" satisfies TPageNavigationPaneTab,
              },
            });
            router.push(updatedRoute);
          },
          title: translate("web.version_history"),
          icon: HistoryOutline,
          shouldRender: true,
        },
        {
          key: "export",
          action: () => setIsExportModalOpen(true),
          title: translate("web.export"),
          icon: Download,
          shouldRender: true,
        },
      ];
    },
    [
      handleFullWidth,
      isFullWidth,
      handleStickyToolbar,
      isStickyToolbarEnabled,
      isContentEditable,
      editorRef,
      updateQueryParams,
      router,
      setIsExportModalOpen,
    ]
  );

  return (
    <>
      <ExportPageModal
        editorRef={editorRef}
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        pageTitle={name ?? ""}
      />
      <PageActions
        extraOptions={EXTRA_MENU_OPTIONS}
        optionsOrder={[
          "full-screen",
          "sticky-toolbar",
          "version-history",
          "make-a-copy",
          "move",
          "delete",
          "toggle-access",
          "copy-markdown",
          "export",
          "archive-restore",
        ]}
        page={page}
        storeType={storeType}
      />
    </>
  );
});
