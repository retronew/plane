/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useMemo } from "react";
import { observer } from "mobx-react";
// plane imports
import { PlateEditorWithRef } from "@plane/editor/plate";
import { usePageCollaboration } from "./use-page-collaboration";
import { Button } from "@makeplane/propel/components/button";
import { CollaborativePageTitle, updateCollaborativeTitle } from "./collaborative-title";
import type { EditorRefApi, TAIMenuProps, TDisplayConfig, TFileHandler } from "@plane/editor";
import { useTranslation } from "@plane/i18n";
import type { TSearchEntityRequestPayload, TSearchResponse, TWebhookConnectionQueryParams } from "@plane/types";
import { ERowVariant, Row } from "@plane/blocks/layout";
import { cn, generateRandomColor, hslToHex } from "@plane/utils";
// components
import { EditorMentionsRoot } from "@/components/editor/embeds/mentions";
// hooks
import { useEditorMention } from "@/hooks/editor";
import { useMember } from "@/hooks/store/use-member";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUser } from "@/hooks/store/user";
import { usePageFilters } from "@/hooks/use-page-filters";
import { useParseEditorContent } from "@/hooks/use-parse-editor-content";
// plane web imports
import type { TCustomEventHandlers } from "@/hooks/use-realtime-page-events";
import { useRealtimePageEvents } from "@/hooks/use-realtime-page-events";
import type { TExtendedEditorExtensionsConfig } from "@/hooks/pages";
import type { EPageStoreType } from "@/hooks/store";
import { useEditorFlagging } from "@/hooks/use-editor-flagging";
// store
import type { TPageInstance } from "@/store/pages/base-page";
// local imports
import { PageContentLoader } from "../loaders/page-content-loader";
import { PageEditorHeaderRoot } from "./header";
import { PageContentBrowser } from "./summary";
import { EditorAIMenu } from "./ai/menu";

export type TEditorBodyConfig = {
  fileHandler: TFileHandler;
};

export type TEditorBodyHandlers = {
  fetchEntity: (payload: TSearchEntityRequestPayload) => Promise<TSearchResponse>;
  getRedirectionLink: (pageId?: string) => string;
};

type Props = {
  config: TEditorBodyConfig;
  editorReady: boolean;
  editorForwardRef: React.RefObject<EditorRefApi | null>;
  handleEditorReady: (status: boolean) => void;
  handleOpenNavigationPane: () => void;
  handlers: TEditorBodyHandlers;
  isNavigationPaneOpen: boolean;
  page: TPageInstance;
  webhookConnectionParams: TWebhookConnectionQueryParams;
  projectId?: string;
  workspaceSlug: string;
  storeType: EPageStoreType;
  customRealtimeEventHandlers?: TCustomEventHandlers;
  extendedEditorProps: TExtendedEditorExtensionsConfig;
};

export const PageEditorBody = observer(function PageEditorBody(props: Props) {
  const {
    config,
    editorForwardRef,
    handleEditorReady,
    handleOpenNavigationPane,
    handlers,
    isNavigationPaneOpen,
    page,
    storeType,
    projectId,
    workspaceSlug,
    extendedEditorProps,
  } = props;
  // refs
  // store hooks
  const { data: currentUser } = useUser();
  const { getWorkspaceBySlug } = useWorkspace();
  const { getUserDetails } = useMember();
  // derived values
  const {
    id: pageId,
    isContentEditable,
    editor: { editorRef, updateAssetsList },
    setSyncingStatus,
  } = page;
  const workspaceId = getWorkspaceBySlug(workspaceSlug)?.id ?? "";
  // use editor mention
  const { fetchMentions } = useEditorMention({
    enableAdvancedMentions: true,
    searchEntity: handlers.fetchEntity,
  });
  // editor flaggings
  const { document: documentEditorExtensions } = useEditorFlagging({
    workspaceSlug,
    projectId,
    storeType,
  });
  // parse content
  const { getEditorMetaData } = useParseEditorContent({
    projectId,
    workspaceSlug,
  });
  // page filters
  const { fontSize, fontStyle, isFullWidth } = usePageFilters();
  // translation
  const { t } = useTranslation();
  // derived values
  const displayConfig: TDisplayConfig = useMemo(
    () => ({
      fontSize,
      fontStyle,
      wideLayout: isFullWidth,
    }),
    [fontSize, fontStyle, isFullWidth]
  );

  // Use the new hook to handle page events
  const { updatePageProperties } = useRealtimePageEvents({
    storeType,
    page,
    getUserDetails,
    handlers,
    customRealtimeEventHandlers: props.customRealtimeEventHandlers,
  });

  // Set syncing status when page changes and reset collaboration state
  useEffect(() => {
    setSyncingStatus("syncing");
  }, [pageId, setSyncingStatus]);

  const getAIMenu = useCallback(
    ({ isOpen, onClose }: TAIMenuProps) => (
      <EditorAIMenu
        editorRef={editorRef}
        isOpen={isOpen}
        onClose={onClose}
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        title={page.name ?? ""}
      />
    ),
    [editorRef, workspaceId, workspaceSlug, page.name]
  );

  const userConfig = useMemo(
    () => ({
      id: currentUser?.id ?? "",
      name: currentUser?.display_name ?? "",
      avatar: currentUser?.avatar_url ?? null,
      color: hslToHex(generateRandomColor(currentUser?.id ?? "")),
    }),
    [currentUser?.display_name, currentUser?.id, currentUser?.avatar_url]
  );

  const {
    reconnecting,
    provider,
    fenced,
    saveError,
    generation,
    copyError,
    snapshot,
    loadError,
    mutate,
    collaboration,
    reconnect,
  } = usePageCollaboration({ page, projectId, workspaceSlug, editorForwardRef, userConfig, updatePageProperties });
  const updateTitle = useCallback((title: string) => page.updateTitle(title), [page]);

  const blockWidthClassName = cn("mx-auto block w-full max-w-[720px] bg-transparent", {
    "max-w-[1152px]": isFullWidth,
  });

  if (loadError && !snapshot) return <PageLoadError retry={() => void mutate()} />;
  if (pageId === undefined || !collaboration || !snapshot) return <PageContentLoader className={blockWidthClassName} />;
  const canEdit = isContentEditable && snapshot.can_edit && !fenced && !reconnecting;

  return (
    <Row
      className="vertical-scrollbar relative scrollbar-md flex size-full flex-col overflow-x-hidden overflow-y-auto duration-200"
      variant={ERowVariant.HUGGING}
    >
      <div id="page-content-container" className="relative w-full flex-shrink-0">
        {/* table of content */}
        <PageOutline
          isNavigationPaneOpen={isNavigationPaneOpen}
          editorRef={editorRef}
          handleOpenNavigationPane={handleOpenNavigationPane}
        />
        <div>
          <div className={cn("page-header-container group/page-header", { "wide-layout": isFullWidth })}>
            <div className={blockWidthClassName}>
              <PageEditorHeaderRoot
                page={page}
                projectId={projectId}
                workspaceSlug={workspaceSlug}
                setTitle={(title) => {
                  if (provider) updateCollaborativeTitle(provider.document.getText("title"), title);
                }}
                titleReady={!!provider && !fenced && !reconnecting}
              />
              <CollaborativePageTitle
                key={`${pageId}:${generation}`}
                provider={provider}
                editable={canEdit}
                initialValue={snapshot.name}
                onTitleChange={updateTitle}
              />
            </div>
          </div>
          <div
            className={cn("page-header-container min-h-screen cursor-text", { "wide-layout": isFullWidth })}
            role="presentation"
            onMouseDown={(event) => {
              if (!canEdit || event.button !== 0 || event.target !== event.currentTarget) return;
              event.preventDefault();
              editorForwardRef.current?.focus("end");
            }}
          >
            <div className={blockWidthClassName}>
              <PlateEditorWithRef
                key={`${pageId}:${snapshot.epoch}:${generation}`}
                mode="document"
                placeholder={canEdit ? t("web.runtime.editor_commands") : ""}
                toolbar="floating"
                initialValue={snapshot.description_html}
                collaboration={collaboration}
                editable={canEdit}
                id={pageId}
                fileHandler={config.fileHandler}
                handleEditorReady={handleEditorReady}
                ref={editorForwardRef}
                containerClassName="h-full p-0"
                displayConfig={displayConfig}
                getEditorMetaData={getEditorMetaData}
                mentionHandler={{
                  searchCallback: async (query) => {
                    const res = await fetchMentions(query);
                    if (!res) throw new Error("Failed in fetching mentions");
                    return res;
                  },
                  // oxlint-disable-next-line no-shadow
                  renderComponent: (props) => <EditorMentionsRoot {...props} />,
                  getMentionedEntityDetails: (id: string) => ({ display_name: getUserDetails(id)?.display_name ?? "" }),
                }}
                disabledExtensions={documentEditorExtensions.disabled}
                flaggedExtensions={documentEditorExtensions.flagged}
                aiHandler={{
                  menu: getAIMenu,
                }}
                onAssetChange={updateAssetsList}
                extendedEditorProps={extendedEditorProps}
              />
            </div>
          </div>
        </div>
      </div>
      <PageSaveNotice saveError={saveError} fenced={fenced} copyError={copyError} reconnect={reconnect} />
    </Row>
  );
});

function PageSaveNotice({
  saveError,
  fenced,
  copyError,
  reconnect,
}: {
  saveError: boolean;
  fenced: boolean;
  copyError: boolean;
  reconnect: () => Promise<void>;
}) {
  const { t } = useTranslation();
  if (!saveError && !fenced && !copyError) return null;
  return (
    <div className="sticky bottom-4 z-10 w-full shrink-0 px-4">
      <div className="mx-auto max-w-[720px] rounded-lg border border-subtle-1 bg-surface-1 p-3 text-13 text-danger-primary shadow-raised-100">
        {(saveError || fenced) && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3">
            <p>{t(fenced ? "editor_collaboration.conflict" : "editor_collaboration.save_error")}</p>
            <Button
              size="sm"
              stretch="auto"
              variant="secondary"
              label={t("editor_collaboration.copy_reconnect")}
              onClick={() => void reconnect()}
            />
          </div>
        )}
        {copyError && (
          <p role="alert" className="mt-2">
            {t("editor_collaboration.copy_error")}
          </p>
        )}
      </div>
    </div>
  );
}

function PageLoadError({ retry }: { retry: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert">
      <p>{t("editor_collaboration.load_error")}</p>
      <Button
        size="sm"
        stretch="auto"
        variant="secondary"
        label={t("editor_comparison.retryConnection")}
        onClick={retry}
      />
    </div>
  );
}
function PageOutline({
  isNavigationPaneOpen,
  editorRef,
  handleOpenNavigationPane,
}: {
  isNavigationPaneOpen: boolean;
  editorRef: EditorRefApi | null;
  handleOpenNavigationPane: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {" "}
      {!isNavigationPaneOpen && (
        <div className="page-summary-container absolute top-[64px] right-0 z-[5] h-full">
          <div className="sticky top-[72px]">
            <div className="group/page-toc relative px-page-x">
              <button
                type="button"
                className="max-h-[50vh] !cursor-pointer overflow-hidden"
                aria-label={t("page_navigation_pane.outline_floating_button")}
                onClick={handleOpenNavigationPane}
              >
                <PageContentBrowser className="overflow-y-auto" editorRef={editorRef} showOutline />
              </button>
              <div className="vertical-scrollbar pointer-events-none absolute top-0 right-0 scrollbar-sm max-h-[70vh] w-52 translate-x-1/2 overflow-y-auto rounded-sm bg-surface-2 p-4 whitespace-nowrap opacity-0 transition-all duration-300 group-hover/page-toc:pointer-events-auto group-hover/page-toc:-translate-x-1/4 group-hover/page-toc:opacity-100">
                <PageContentBrowser className="overflow-y-auto" editorRef={editorRef} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
