/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ImageOutline, RefreshOutline } from "@makeplane/propel/icons";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
// plane imports
import { cn } from "@plane/utils";
// constants
import { ACCEPTED_IMAGE_MIME_TYPES } from "@/constants/config";
import { CORE_EXTENSIONS } from "@/constants/extension";
// helpers
import type { EFileError } from "@/helpers/file";
// hooks
import { useUploader, useDropZone, uploadFirstFileAndInsertRemaining } from "@/hooks/use-file-upload";
// local imports
import { ECustomImageStatus } from "../types";
import { getImageComponentImageFileMap } from "../utils";
import type { CustomImageNodeViewProps } from "./node-view";
import { translate } from "@plane/i18n";

type CustomImageUploaderProps = CustomImageNodeViewProps & {
  failedToLoadImage: boolean;
  hasDuplicationFailed: boolean;
  loadImageFromFileSystem: (file: string | undefined) => void;
  maxFileSize: number;
};

// Tiptap storage is a mutable editor-owned integration point shared by uploaders.
function setEditorUploadProgress(editor: CustomImageNodeViewProps["editor"], isUploading: boolean) {
  editor.storage.utility.uploadInProgress = isUploading;
}

export function CustomImageUploader(props: CustomImageUploaderProps) {
  const { editor, extension, getPos, loadImageFromFileSystem, maxFileSize, node, updateAttributes } = props;
  // refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasTriggeredFilePickerRef = useRef(false);
  const hasTriedUploadingOnMountRef = useRef(false);
  const { id: imageEntityId } = node.attrs;
  // derived values
  const imageComponentImageFileMap = useMemo(() => getImageComponentImageFileMap(editor), [editor]);
  const isTouchDevice = !!editor.storage.utility.isTouchDevice;

  const onUpload = useCallback(
    (url: string) => {
      if (url) {
        if (!imageEntityId) return;
        loadImageFromFileSystem(undefined);
        // Update the node view's src attribute post upload
        updateAttributes({
          src: url,
          status: ECustomImageStatus.UPLOADED,
        });
        imageComponentImageFileMap?.delete(imageEntityId);

        const pos = getPos();
        // get current node
        const getCurrentSelection = editor.state.selection;
        const currentNode = editor.state.doc.nodeAt(getCurrentSelection.from);

        // only if the cursor is at the current image component, manipulate
        // the cursor position
        if (
          currentNode &&
          currentNode.type.name === node.type.name &&
          currentNode.attrs.src === url &&
          pos !== undefined
        ) {
          // control cursor position after upload
          const nextNode = editor.state.doc.nodeAt(pos + 1);

          if (nextNode && nextNode.type.name === CORE_EXTENSIONS.PARAGRAPH) {
            // If there is a paragraph node after the image component, move the focus to the next node
            editor.commands.setTextSelection(pos + 1);
          } else {
            // create a new paragraph after the image component post upload
            editor.commands.createParagraphNear();
          }
        }
      }
    },
    [
      editor,
      node.type.name,
      loadImageFromFileSystem,
      imageComponentImageFileMap,
      imageEntityId,
      updateAttributes,
      getPos,
    ]
  );

  const uploadImageEditorCommand = useCallback(
    async (file: File) => {
      updateAttributes({ status: ECustomImageStatus.UPLOADING });
      return await extension.options.uploadImage?.(imageEntityId ?? "", file);
    },
    [extension.options, imageEntityId, updateAttributes]
  );

  const handleProgressStatus = useCallback(
    (isUploading: boolean) => {
      setEditorUploadProgress(editor, isUploading);
    },
    [editor]
  );

  const handleInvalidFile = useCallback((_error: EFileError, _file: File, message: string) => {
    alert(message);
  }, []);

  // hooks
  const { isUploading: isImageBeingUploaded, uploadFile } = useUploader({
    acceptedMimeTypes: ACCEPTED_IMAGE_MIME_TYPES,
    editorCommand: uploadImageEditorCommand,
    handleProgressStatus,
    loadFileFromFileSystem: loadImageFromFileSystem,
    maxFileSize,
    onInvalidFile: handleInvalidFile,
    onUpload,
  });

  const { draggedInside, onDrop, onDragEnter, onDragLeave } = useDropZone({
    editor,
    getPos,
    type: "image",
    uploader: uploadFile,
  });

  // after the image component is mounted we start the upload process based on
  // it's uploaded
  useEffect(() => {
    if (hasTriedUploadingOnMountRef.current) return;

    // the meta data of the image component
    const meta = imageComponentImageFileMap?.get(imageEntityId ?? "");
    if (meta) {
      if (meta.event === "drop" && "file" in meta) {
        hasTriedUploadingOnMountRef.current = true;
        // Consume the queued file before uploading; node views can remount during the request.
        imageComponentImageFileMap?.delete(imageEntityId ?? "");
        uploadFile(meta.file);
      } else if (meta.event === "insert" && fileInputRef.current && !hasTriggeredFilePickerRef.current) {
        if (meta.hasOpenedFileInputOnce) return;
        if (!isTouchDevice) {
          fileInputRef.current.click();
        }
        hasTriggeredFilePickerRef.current = true;
        imageComponentImageFileMap?.set(imageEntityId ?? "", { ...meta, hasOpenedFileInputOnce: true });
      }
    } else {
      hasTriedUploadingOnMountRef.current = true;
    }
  }, [imageEntityId, isTouchDevice, uploadFile, imageComponentImageFileMap]);

  const onFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();
      const filesList = e.target.files;
      const pos = getPos();
      if (!filesList || pos === undefined) {
        return;
      }
      await uploadFirstFileAndInsertRemaining({
        editor,
        filesList,
        pos,
        type: "image",
        uploader: uploadFile,
      });
    },
    [uploadFile, editor, getPos]
  );

  return (
    <ImageUploadArea
      {...props}
      isImageBeingUploaded={isImageBeingUploaded}
      dropZone={{ draggedInside, onDrop, onDragEnter, onDragLeave }}
      fileInputRef={fileInputRef}
      onFileChange={onFileChange}
    />
  );
}

type ImageUploadAreaProps = CustomImageUploaderProps & {
  isImageBeingUploaded: boolean;
  dropZone: Pick<ReturnType<typeof useDropZone>, "draggedInside" | "onDrop" | "onDragEnter" | "onDragLeave">;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
};

function ImageUploadArea({
  editor,
  selected,
  failedToLoadImage,
  hasDuplicationFailed,
  updateAttributes,
  isImageBeingUploaded,
  dropZone: { draggedInside, onDrop, onDragEnter, onDragLeave },
  fileInputRef,
  onFileChange,
}: ImageUploadAreaProps) {
  const isErrorState = failedToLoadImage || hasDuplicationFailed;
  const canChooseFile = editor.isEditable && !isErrorState;
  const isSelectedPicker = selected && canChooseFile;
  const isSelectedError = isErrorState && selected;
  const canRetry = hasDuplicationFailed && editor.isEditable;

  const borderColor = isSelectedPicker
    ? "color-mix(in srgb, var(--border-color-accent-strong) 20%, transparent)"
    : undefined;

  const getDisplayMessage = useCallback(() => {
    const isUploading = isImageBeingUploaded;
    if (isErrorState) {
      return translate("web.runtime.image_load_error");
    }

    if (isUploading) {
      return translate("web.uploading");
    }

    if (draggedInside && editor.isEditable) {
      return translate("web.drop_image_here_to_upload");
    }

    return translate("web.insert_an_image");
  }, [draggedInside, editor.isEditable, isErrorState, isImageBeingUploaded]);

  const handleRetryClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (hasDuplicationFailed && editor.isEditable) {
        updateAttributes({ status: ECustomImageStatus.DUPLICATING });
      }
    },
    [hasDuplicationFailed, editor.isEditable, updateAttributes]
  );

  return (
    <div
      className={cn(
        "image-upload-component flex cursor-default items-center justify-start gap-2 rounded-lg border border-dashed bg-layer-3 px-2 py-3 text-tertiary transition-all duration-200 ease-in-out",
        {
          "border-subtle": !isSelectedPicker,
          "cursor-pointer hover:bg-layer-3-hover hover:text-secondary": canChooseFile,
          "bg-layer-3-hover text-secondary": draggedInside && canChooseFile,
          "bg-accent-primary/10 text-accent-secondary hover:bg-accent-primary/10 hover:text-accent-secondary":
            isSelectedPicker,
          "cursor-default bg-danger-subtle text-danger-primary": isErrorState,
          "hover:bg-danger-subtle-hover hover:text-danger-primary": isErrorState && editor.isEditable,
          "bg-danger-subtle-selected": isSelectedError,
          "hover:bg-danger-subtle-active": isSelectedError && editor.isEditable,
        }
      )}
      style={borderColor ? { borderColor } : undefined}
      onDrop={onDrop}
      onDragOver={onDragEnter}
      onDragLeave={onDragLeave}
      contentEditable={false}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 self-stretch text-left text-14 font-medium disabled:cursor-default"
        disabled={!canChooseFile}
        onClick={() => fileInputRef.current?.click()}
      >
        <ImageOutline className="size-4" />
        <span className="flex-1">{getDisplayMessage()}</span>
      </button>
      {canRetry && (
        <button
          type="button"
          onClick={handleRetryClick}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 font-medium text-danger-primary transition-all duration-200 ease-in-out hover:bg-danger-subtle-hover",
            {
              "hover:bg-danger-subtle-hover": selected,
            }
          )}
          title={translate("web.retry_duplication")}
        >
          <RefreshOutline className="size-3" />
          <span className="text-11">{translate("web.retry")}</span>
        </button>
      )}
      <input
        className="size-0 overflow-hidden"
        ref={fileInputRef}
        hidden
        type="file"
        accept={ACCEPTED_IMAGE_MIME_TYPES.join(",")}
        onChange={onFileChange}
        multiple
      />
    </div>
  );
}
