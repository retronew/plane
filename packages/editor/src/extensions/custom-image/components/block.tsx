/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { NodeSelection } from "@tiptap/pm/state";
import React, { useCallback } from "react";
// plane imports
import { translate } from "@plane/i18n";
import { cn } from "@plane/utils";
// local imports
import { ECustomImageAttributeNames } from "../types";
import type { TCustomImageAttributes } from "../types";
import { getImageBlockId, isImageDuplicating } from "../utils";
import type { CustomImageNodeViewProps } from "./node-view";
import { ImageToolbarRoot } from "./toolbar";
import { ImageUploadStatus } from "./upload-status";
import { useImageRecovery } from "./use-image-recovery";
import { useImageSize } from "./use-image-size";

type CustomImageBlockProps = CustomImageNodeViewProps & {
  editorContainer: HTMLDivElement | null;
  imageFromFileSystem: string | undefined;
  setEditorContainer: (editorContainer: HTMLDivElement | null) => void;
  setFailedToLoadImage: (isError: boolean) => void;
  src: string | undefined;
  downloadSrc: string | undefined;
};

export function CustomImageBlock(props: CustomImageBlockProps) {
  // props
  const {
    editor,
    editorContainer,
    extension,
    getPos,
    imageFromFileSystem,
    node,
    selected,
    setEditorContainer,
    setFailedToLoadImage,
    src: resolvedImageSrc,
    downloadSrc: resolvedDownloadSrc,
    updateAttributes,
  } = props;
  const { src: imgNodeSrc, alignment: nodeAlignment, status } = node.attrs;
  // extension options
  const isTouchDevice = !!(editor.storage.utility as { isTouchDevice?: boolean } | undefined)?.isTouchDevice;

  const updateAttributesSafely = useCallback(
    (attributes: Partial<TCustomImageAttributes>, errorMessage: string) => {
      try {
        updateAttributes(attributes);
      } catch (error) {
        console.error(`${errorMessage}:`, error);
      }
    },
    [updateAttributes]
  );

  const {
    imageRef,
    containerRef,
    size,
    isResizing,
    initialResizeComplete,
    handleImageLoad,
    handleResizeStart,
    handleResizeKeyDown,
  } = useImageSize({
    attrs: node.attrs,
    editorContainer,
    setEditorContainer,
    updateAttributes: updateAttributesSafely,
  });

  const displayedImageSrc = resolvedImageSrc || imageFromFileSystem;
  const { isRecovering, handleImageError } = useImageRecovery({
    imageRef,
    nodeSrc: imgNodeSrc,
    resolvedSrc: resolvedImageSrc,
    displayedSrc: displayedImageSrc,
    isTouchDevice,
    options: extension.options,
    setFailedToLoadImage,
  });

  const handleImageMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isTouchDevice) {
        e.preventDefault();
        editor.commands.blur();
      }
      const pos = getPos();
      if (pos === undefined) return;
      const nodeSelection = NodeSelection.create(editor.state.doc, pos);
      editor.view.dispatch(editor.state.tr.setSelection(nodeSelection));
    },
    [editor, getPos, isTouchDevice]
  );

  const isDuplicating = isImageDuplicating(status);
  // show the image loader if the remote image's src or preview image from filesystem is not set yet (while loading the image post upload) (or)
  // if the initial resize (from 35% width and "auto" height attrs to the actual size in px) is not complete
  const showImageLoader =
    (!resolvedImageSrc && !isDuplicating) || !initialResizeComplete || isRecovering || isDuplicating; // show the image upload status only when the resolvedImageSrc is not ready
  const showUploadStatus = !resolvedImageSrc && !isDuplicating;
  // show the image utils only if the remote image's (post upload) src is set and the initial resize is complete (but not while we're showing the preview imageFromFileSystem)
  const showImageToolbar = resolvedImageSrc && resolvedDownloadSrc && initialResizeComplete && !isDuplicating;
  // show the image resizer only if the editor is editable, the remote image's (post upload) src is set and the initial resize is complete (but not while we're showing the preview imageFromFileSystem)
  const showImageResizer = editor.isEditable && resolvedImageSrc && initialResizeComplete && !isDuplicating;

  return (
    <div
      id={
        node.attrs[ECustomImageAttributeNames.ID]
          ? getImageBlockId(node.attrs[ECustomImageAttributeNames.ID])
          : undefined
      }
      className={cn("w-fit max-w-full transition-all", {
        "ml-[50%] -translate-x-1/2": nodeAlignment === "center",
        "ml-[100%] -translate-x-full": nodeAlignment === "right",
      })}
    >
      {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- Pointer selection sets ProseMirror's NodeSelection (and blurs the virtual keyboard on touch); this selectable editor node already uses ProseMirror keyboard navigation. */}
      <div
        ref={containerRef}
        onMouseDown={handleImageMouseDown}
        className="group/image-component relative inline-block max-w-full"
        style={{
          width: size.width,
          ...(size.aspectRatio && { aspectRatio: size.aspectRatio }),
        }}
      >
        {showImageLoader && (
          <div className="animate-pulse rounded-md bg-layer-1" style={{ width: size.width, height: size.height }} />
        )}
        <img
          ref={imageRef}
          src={displayedImageSrc}
          alt=""
          onLoad={handleImageLoad}
          onError={() => void handleImageError()}
          width={size.width}
          className={cn("image-component block rounded-md", {
            // hide the image while the background calculations of the image loader are in progress (to avoid flickering) and show the loader until then
            hidden: showImageLoader,
            "read-only-image": !editor.isEditable,
            "loading-image opacity-80 blur-sm": !resolvedImageSrc,
          })}
          style={{
            width: size.width,
            ...(size.aspectRatio && { aspectRatio: size.aspectRatio }),
          }}
        />
        {showUploadStatus && node.attrs[ECustomImageAttributeNames.ID] && (
          <ImageUploadStatus editor={editor} nodeId={node.attrs[ECustomImageAttributeNames.ID]} />
        )}
        {showImageToolbar && (
          <ImageToolbarRoot
            alignment={nodeAlignment ?? "left"}
            editor={editor}
            aspectRatio={size.aspectRatio === null ? 1 : size.aspectRatio}
            downloadSrc={resolvedDownloadSrc}
            handleAlignmentChange={(alignment) =>
              updateAttributesSafely({ alignment }, "Failed to update attributes while changing alignment:")
            }
            height={size.height}
            isTouchDevice={isTouchDevice}
            width={size.width}
            src={resolvedImageSrc}
          />
        )}
        {selected && displayedImageSrc === resolvedImageSrc && (
          <div className="pointer-events-none absolute inset-0 size-full bg-accent-primary/30" />
        )}
        {showImageResizer && (
          <>
            <div
              className={cn(
                "pointer-events-none absolute inset-0 rounded-md border-2 border-accent-strong transition-opacity duration-100 ease-in-out",
                {
                  "opacity-100": isResizing,
                  "opacity-0 group-hover/image-component:opacity-100": !isResizing,
                }
              )}
            />
            <button
              type="button"
              aria-label={translate("web.image")}
              className={cn(
                "absolute bottom-0 size-4 translate-y-1/2 rounded-full border-2 border-white bg-accent-primary transition-opacity duration-100 ease-in-out focus:pointer-events-auto focus:opacity-100",
                {
                  "pointer-events-auto opacity-100": isResizing,
                  "pointer-events-none opacity-0 group-hover/image-component:pointer-events-auto group-hover/image-component:opacity-100":
                    !isResizing,
                  "left-0 -translate-x-1/2 cursor-nesw-resize": nodeAlignment === "right",
                  "right-0 translate-x-1/2 cursor-nwse-resize": nodeAlignment !== "right",
                }
              )}
              onMouseDown={handleResizeStart}
              onTouchStart={handleResizeStart}
              onKeyDown={handleResizeKeyDown}
            />
          </>
        )}
      </div>
    </div>
  );
}
