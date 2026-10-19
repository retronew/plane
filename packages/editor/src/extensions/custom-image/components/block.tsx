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
import type { TCustomImageAlignment, TCustomImageAttributes, TCustomImageSize } from "../types";
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

/** Alignment drives only the block wrapper's horizontal placement; every other value is `left`. */
const IMAGE_ALIGNMENT_CLASSNAME: Record<TCustomImageAlignment, string> = {
  left: "",
  center: "ml-[50%] -translate-x-1/2",
  right: "ml-[100%] -translate-x-full",
};

type ImageToolbarVisibility = { visible: false } | { visible: true; src: string; downloadSrc: string };

type ImageVisibility = {
  showImageLoader: boolean;
  showUploadStatus: boolean;
  toolbar: ImageToolbarVisibility;
  showImageResizer: boolean;
};

type ImageVisibilityParams = {
  resolvedImageSrc: string | undefined;
  resolvedDownloadSrc: string | undefined;
  isEditable: boolean;
  initialResizeComplete: boolean;
  isRecovering: boolean;
  isDuplicating: boolean;
};

function resolveToolbarSources(
  resolvedImageSrc: string | undefined,
  resolvedDownloadSrc: string | undefined
): { src: string; downloadSrc: string } | undefined {
  if (!resolvedImageSrc || !resolvedDownloadSrc) return undefined;
  return { src: resolvedImageSrc, downloadSrc: resolvedDownloadSrc };
}

function getImageToolbarVisibility(
  resolvedImageSrc: string | undefined,
  resolvedDownloadSrc: string | undefined,
  initialResizeComplete: boolean,
  isDuplicating: boolean
): ImageToolbarVisibility {
  if (!initialResizeComplete || isDuplicating) return { visible: false };
  const sources = resolveToolbarSources(resolvedImageSrc, resolvedDownloadSrc);
  return sources ? { visible: true, ...sources } : { visible: false };
}

/** Show the image utils only if the remote image's (post upload) src is set and the initial resize
 *  is complete (but not while we're showing the preview imageFromFileSystem). */
function canResizeImage(
  isEditable: boolean,
  resolvedImageSrc: string | undefined,
  initialResizeComplete: boolean,
  isDuplicating: boolean
): boolean {
  return isEditable && !!resolvedImageSrc && initialResizeComplete && !isDuplicating;
}

function getImageVisibility(params: ImageVisibilityParams): ImageVisibility {
  const { resolvedImageSrc, resolvedDownloadSrc, isEditable, initialResizeComplete, isRecovering, isDuplicating } =
    params;
  // Show the image loader if the remote image's src or preview image from filesystem is not set yet
  // (while loading the image post upload) (or) if the initial resize (from 35% width and "auto"
  // height attrs to the actual size in px) is not complete.
  const showUploadStatus = !resolvedImageSrc && !isDuplicating;
  return {
    showUploadStatus,
    showImageLoader: showUploadStatus || !initialResizeComplete || isRecovering || isDuplicating,
    toolbar: getImageToolbarVisibility(resolvedImageSrc, resolvedDownloadSrc, initialResizeComplete, isDuplicating),
    showImageResizer: canResizeImage(isEditable, resolvedImageSrc, initialResizeComplete, isDuplicating),
  };
}

function getBlockElementId(nodeId: string | null): string | undefined {
  return nodeId ? getImageBlockId(nodeId) : undefined;
}

function useSafeUpdateAttributes(updateAttributes: CustomImageBlockProps["updateAttributes"]) {
  return useCallback(
    (attributes: Partial<TCustomImageAttributes>, errorMessage: string) => {
      try {
        updateAttributes(attributes);
      } catch (error) {
        console.error(`${errorMessage}:`, error);
      }
    },
    [updateAttributes]
  );
}

function useImageBlockMouseDown({
  editor,
  getPos,
  isTouchDevice,
}: Pick<CustomImageBlockProps, "editor" | "getPos"> & { isTouchDevice: boolean }) {
  return useCallback(
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
}

type CustomImageElementProps = {
  imageRef: React.RefObject<HTMLImageElement | null>;
  src: string | undefined;
  size: TCustomImageSize;
  showImageLoader: boolean;
  isEditable: boolean;
  hasResolvedSrc: boolean;
  onLoad: () => void;
  onError: () => void;
};

function CustomImageElement(props: CustomImageElementProps) {
  const { imageRef, src, size, showImageLoader, isEditable, hasResolvedSrc, onLoad, onError } = props;

  return (
    <img
      ref={imageRef}
      src={src}
      alt=""
      onLoad={onLoad}
      onError={onError}
      width={size.width}
      className={cn("image-component block rounded-md", {
        // hide the image while the background calculations of the image loader are in progress (to avoid flickering) and show the loader until then
        hidden: showImageLoader,
        "read-only-image": !isEditable,
        "loading-image opacity-80 blur-sm": !hasResolvedSrc,
      })}
      style={{
        width: size.width,
        ...(size.aspectRatio && { aspectRatio: size.aspectRatio }),
      }}
    />
  );
}

type ImageResizeOverlayProps = {
  isResizing: boolean;
  alignment: TCustomImageAlignment;
  onResizeStart: (event: React.MouseEvent | React.TouchEvent) => void;
  onResizeKeyDown: (event: React.KeyboardEvent) => void;
};

function ImageResizeOverlay(props: ImageResizeOverlayProps) {
  const { isResizing, alignment, onResizeStart, onResizeKeyDown } = props;

  return (
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
            "left-0 -translate-x-1/2 cursor-nesw-resize": alignment === "right",
            "right-0 translate-x-1/2 cursor-nwse-resize": alignment !== "right",
          }
        )}
        onMouseDown={onResizeStart}
        onTouchStart={onResizeStart}
        onKeyDown={onResizeKeyDown}
      />
    </>
  );
}

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

  const updateAttributesSafely = useSafeUpdateAttributes(updateAttributes);

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

  const handleImageMouseDown = useImageBlockMouseDown({ editor, getPos, isTouchDevice });

  const isDuplicating = isImageDuplicating(status);
  const { showImageLoader, showUploadStatus, toolbar, showImageResizer } = getImageVisibility({
    resolvedImageSrc,
    resolvedDownloadSrc,
    isEditable: editor.isEditable,
    initialResizeComplete,
    isRecovering,
    isDuplicating,
  });
  const nodeId = node.attrs[ECustomImageAttributeNames.ID];

  return (
    <div
      id={getBlockElementId(nodeId)}
      className={cn("w-fit max-w-full transition-all", IMAGE_ALIGNMENT_CLASSNAME[nodeAlignment])}
    >
      {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions, react-doctor/no-static-element-interactions -- Pointer selection sets ProseMirror's NodeSelection (and blurs the virtual keyboard on touch); this selectable editor node already uses ProseMirror keyboard navigation. */}
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
        <CustomImageElement
          imageRef={imageRef}
          src={displayedImageSrc}
          size={size}
          showImageLoader={showImageLoader}
          isEditable={editor.isEditable}
          hasResolvedSrc={!!resolvedImageSrc}
          onLoad={handleImageLoad}
          onError={() => void handleImageError()}
        />
        {showUploadStatus && nodeId && <ImageUploadStatus editor={editor} nodeId={nodeId} />}
        {toolbar.visible && (
          <ImageToolbarRoot
            alignment={nodeAlignment ?? "left"}
            editor={editor}
            aspectRatio={size.aspectRatio === null ? 1 : size.aspectRatio}
            downloadSrc={toolbar.downloadSrc}
            handleAlignmentChange={(alignment) =>
              updateAttributesSafely({ alignment }, "Failed to update attributes while changing alignment:")
            }
            height={size.height}
            isTouchDevice={isTouchDevice}
            width={size.width}
            src={toolbar.src}
          />
        )}
        {selected && displayedImageSrc === resolvedImageSrc && (
          <div className="pointer-events-none absolute inset-0 size-full bg-accent-primary/30" />
        )}
        {showImageResizer && (
          <ImageResizeOverlay
            isResizing={isResizing}
            alignment={nodeAlignment}
            onResizeStart={handleResizeStart}
            onResizeKeyDown={handleResizeKeyDown}
          />
        )}
      </div>
    </div>
  );
}
