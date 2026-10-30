/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState, useCallback } from "react";
// plane constants
import type { EIssueCommentAccessSpecifier } from "@plane/constants";
// plane editor
import { PlateEditorWithRef } from "@plane/editor/plate";
import type { EditorRefApi, ILiteTextEditorProps, TFileHandler } from "@plane/editor";
// components
import type { TSticky } from "@plane/types";
// helpers
import { cn } from "@plane/utils";
// hooks
import { useEditorConfig } from "@/hooks/editor";
import { useParseEditorContent } from "@/hooks/use-parse-editor-content";
// plane web hooks
import { useEditorFlagging } from "@/hooks/use-editor-flagging";
import { StickyEditorToolbar } from "./toolbar";

interface StickyEditorWrapperProps extends Omit<
  Omit<ILiteTextEditorProps, "extendedEditorProps">,
  "disabledExtensions" | "editable" | "flaggedExtensions" | "fileHandler" | "mentionHandler" | "getEditorMetaData"
> {
  workspaceSlug: string;
  workspaceId: string;
  projectId?: string;
  accessSpecifier?: EIssueCommentAccessSpecifier;
  handleAccessChange?: (accessKey: EIssueCommentAccessSpecifier) => void;
  showAccessSpecifier?: boolean;
  showSubmitButton?: boolean;
  isSubmitting?: boolean;
  showToolbarInitially?: boolean;
  showToolbar?: boolean;
  uploadFile: TFileHandler["upload"];
  duplicateFile: TFileHandler["duplicate"];
  parentClassName?: string;
  handleColorChange: (data: Partial<TSticky>) => Promise<void>;
  handleDelete: () => void;
  selectedColor?: string;
}

export const StickyEditor = React.forwardRef(function StickyEditor(
  props: StickyEditorWrapperProps,
  ref: React.ForwardedRef<EditorRefApi>
) {
  const {
    containerClassName,
    workspaceSlug,
    workspaceId,
    projectId,
    handleDelete,
    handleColorChange,
    showToolbarInitially = true,
    showToolbar = true,
    parentClassName = "",
    uploadFile,
    duplicateFile,
    selectedColor,
    ...rest
  } = props;
  // states
  const [isFocused, setIsFocused] = useState(showToolbarInitially);
  const [editorApi, setEditorApi] = useState<EditorRefApi | null>(null);
  const setEditorRef = useCallback(
    (instance: EditorRefApi | null) => {
      setEditorApi(instance);
      if (typeof ref === "function") ref(instance);
      else if (ref) ref.current = instance;
    },
    [ref]
  );
  // editor flaggings
  const { liteText: liteTextEditorExtensions } = useEditorFlagging({
    workspaceSlug,
    projectId,
  });
  // parse content
  const { getEditorMetaData } = useParseEditorContent({
    projectId,
    workspaceSlug,
  });
  // editor config
  const { getEditorFileHandlers } = useEditorConfig();

  return (
    <div
      className={cn("relative rounded-sm border border-subtle", parentClassName)}
      onFocus={() => !showToolbarInitially && setIsFocused(true)}
      onBlur={() => !showToolbarInitially && setIsFocused(false)}
    >
      <PlateEditorWithRef
        mode="lite"
        toolbar="floating"
        ref={setEditorRef}
        disabledExtensions={[...liteTextEditorExtensions.disabled, "enter-key"]}
        flaggedExtensions={liteTextEditorExtensions.flagged}
        editable
        fileHandler={getEditorFileHandlers({
          projectId,
          uploadFile,
          duplicateFile,
          workspaceId,
          workspaceSlug,
        })}
        getEditorMetaData={getEditorMetaData}
        mentionHandler={{
          renderComponent: () => <></>,
        }}
        extendedEditorProps={{}}
        containerClassName={cn(containerClassName, "relative")}
        {...rest}
      />
      {showToolbar && (
        <div
          className={cn("h-10 origin-top px-2 pb-2 transition-[opacity,transform] duration-200 ease-out", {
            "max-h-10 scale-y-100 opacity-100": isFocused,
            "invisible max-h-0 scale-y-0 opacity-0": !isFocused,
          })}
        >
          <StickyEditorToolbar
            executeCommand={(item) => {
              // TODO: update this while toolbar homogenization
              // @ts-expect-error type mismatch here
              editorApi?.executeMenuItemCommand({
                itemKey: item.itemKey,
                ...item.extraProps,
              });
            }}
            handleDelete={handleDelete}
            handleColorChange={handleColorChange}
            editorRef={editorApi}
            selectedColor={selectedColor}
            showFormatting={false}
          />
        </div>
      )}
    </div>
  );
});

StickyEditor.displayName = "StickyEditor";
