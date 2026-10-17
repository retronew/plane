/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { NodeViewWrapper } from "@tiptap/react";
import { CloseOutline } from "@makeplane/propel/icons";
import { translate } from "@plane/i18n";
import type { NodeViewProps } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
// local imports
import type { CustomImageExtensionType, TCustomImageAttributes } from "../types";
import { ECustomImageAttributeNames, ECustomImageStatus } from "../types";
import { hasImageDuplicationFailed } from "../utils";
import { CustomImageBlock } from "./block";
import { CustomImageUploader } from "./uploader";

export type CustomImageNodeViewProps = Omit<NodeViewProps, "extension" | "updateAttributes"> & {
  extension: CustomImageExtensionType;
  node: NodeViewProps["node"] & {
    attrs: TCustomImageAttributes;
  };
  updateAttributes: (attrs: Partial<TCustomImageAttributes>) => void;
};

// Source-specific state resets before rendering a different asset. The outer node
// stays mounted so upload previews and the editor's node-view lifecycle are preserved.
function CustomImageContent(
  props: CustomImageNodeViewProps & {
    imageFromFileSystem: string | undefined;
    loadImageFromFileSystem: (file: string | undefined) => void;
  }
) {
  const { editor, extension, node, imageFromFileSystem } = props;
  const { src: imgNodeSrc, status } = node.attrs;
  const [sources, setSources] = useState<{ src?: string; downloadSrc?: string; failed?: boolean }>({});
  const [failedToLoadImage, setFailedToLoadImage] = useState(false);
  const [editorContainer, setEditorContainer] = useState<HTMLDivElement | null>(null);
  const { getImageSource, getImageDownloadSource } = extension.options;

  useEffect(() => {
    if (!imgNodeSrc) return;
    let cancelled = false;
    const resolveSources = async () => {
      try {
        const src = await getImageSource?.(imgNodeSrc);
        if (cancelled) return;
        setSources({ src });
        const downloadSrc = await getImageDownloadSource?.(imgNodeSrc);
        if (cancelled) return;
        setSources({ src, downloadSrc });
      } catch (error) {
        if (cancelled) return;
        console.error("Error fetching image source:", error);
        setSources({ failed: true });
      }
    };
    void resolveSources();
    return () => {
      cancelled = true;
    };
  }, [imgNodeSrc, getImageSource, getImageDownloadSource]);

  const hasDuplicationFailed = hasImageDuplicationFailed(status);
  const failed = failedToLoadImage || !!sources.failed;
  const preview = imgNodeSrc ? undefined : imageFromFileSystem;
  const shouldShowBlock = (preview || sources.src) && !failed && !hasDuplicationFailed;

  return shouldShowBlock ? (
    <CustomImageBlock
      {...props}
      editorContainer={editorContainer}
      imageFromFileSystem={preview}
      setEditorContainer={setEditorContainer}
      setFailedToLoadImage={setFailedToLoadImage}
      src={sources.src}
      downloadSrc={sources.downloadSrc}
    />
  ) : (
    <CustomImageUploader
      {...props}
      failedToLoadImage={failed}
      hasDuplicationFailed={hasDuplicationFailed}
      maxFileSize={(editor.storage.imageComponent as { maxFileSize?: number } | undefined)?.maxFileSize ?? 0}
    />
  );
}

export function CustomImageNodeView(props: CustomImageNodeViewProps) {
  const { editor, extension, node, updateAttributes } = props;
  const { src: imgNodeSrc, status } = node.attrs;
  const [imageFromFileSystem, setImageFromFileSystem] = useState<string | undefined>(undefined);
  const hasRetriedOnMount = useRef(false);
  const duplicationRef = useRef<{
    src: string;
    duplicate: NonNullable<CustomImageExtensionType["options"]["duplicateImage"]>;
    promise: Promise<string | undefined>;
  } | null>(null);

  useEffect(() => {
    const duplicateImage = extension.options.duplicateImage;
    if (status !== ECustomImageStatus.DUPLICATING || !duplicateImage || !imgNodeSrc) {
      duplicationRef.current = null;
      return;
    }
    let cancelled = false;
    hasRetriedOnMount.current = true;
    // Reuse the in-flight operation when React replays the effect or the
    // attribute callback changes, but only the current subscriber may write.
    if (duplicationRef.current?.src !== imgNodeSrc || duplicationRef.current.duplicate !== duplicateImage) {
      duplicationRef.current = {
        src: imgNodeSrc,
        duplicate: duplicateImage,
        promise: Promise.resolve().then(() => duplicateImage(imgNodeSrc)),
      };
    }
    const request = duplicationRef.current;
    const handleDuplication = async () => {
      try {
        const newAssetId = await request.promise;
        if (cancelled) return;
        if (!newAssetId) throw new Error("Duplication returned invalid asset ID");
        updateAttributes({ src: newAssetId, status: ECustomImageStatus.UPLOADED });
      } catch (error: unknown) {
        if (cancelled) return;
        console.error("Failed to duplicate image:", error);
        updateAttributes({ status: ECustomImageStatus.DUPLICATION_FAILED });
      }
    };
    void handleDuplication();
    return () => {
      cancelled = true;
    };
  }, [status, imgNodeSrc, extension.options.duplicateImage, updateAttributes]);

  useEffect(() => {
    if (status === ECustomImageStatus.UPLOADED) {
      hasRetriedOnMount.current = false;
    } else if (hasImageDuplicationFailed(status) && !hasRetriedOnMount.current && imgNodeSrc) {
      hasRetriedOnMount.current = true;
      updateAttributes({ status: ECustomImageStatus.DUPLICATING });
    }
  }, [status, imgNodeSrc, updateAttributes]);

  return (
    <NodeViewWrapper key={node.attrs[ECustomImageAttributeNames.ID]}>
      <div className="group/comment-image relative mx-0 my-2 p-0" data-drag-handle>
        {editor.isEditable && extension.options.showDeleteAction && (
          <button
            type="button"
            contentEditable={false}
            aria-label={translate("common.delete")}
            className="shadow-sm absolute top-1 right-1 z-30 grid size-6 place-items-center rounded-sm bg-surface-1 text-secondary opacity-0 group-hover/comment-image:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              props.deleteNode();
            }}
          >
            <CloseOutline className="size-4" />
          </button>
        )}
        <CustomImageContent
          key={imgNodeSrc ?? ""}
          {...props}
          imageFromFileSystem={imageFromFileSystem}
          loadImageFromFileSystem={setImageFromFileSystem}
        />
      </div>
    </NodeViewWrapper>
  );
}
