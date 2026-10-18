/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { forwardRef, useMemo, useRef, useEffect, useCallback } from "react";
import { useEditorPreferences } from "@/components/editor-preferences";
// components
import { EditorWrapper } from "@/components/editors/editor-wrapper";
// extensions
import { EnterKeyExtension as createEnterKeyExtension } from "@/extensions";
// types
import type { EditorRefApi, ILiteTextEditorProps } from "@/types";

const EMPTY_EXTENSIONS: NonNullable<ILiteTextEditorProps["extensions"]> = [];

function LiteTextEditor(props: ILiteTextEditorProps) {
  const { onEnterKeyPress, disabledExtensions, extensions: externalExtensions = EMPTY_EXTENSIONS } = props;

  const { commentSubmitShortcut } = useEditorPreferences();
  const submitShortcut = props.useCommentSubmitShortcut ? commentSubmitShortcut : "enter";

  const current = useRef({ onEnterKeyPress, submitShortcut });
  useEffect(() => {
    current.current = { onEnterKeyPress, submitShortcut };
  }, [onEnterKeyPress, submitShortcut]);
  const submit = useCallback(() => current.current.onEnterKeyPress?.(), []);
  const getShortcut = useCallback(() => current.current.submitShortcut, []);

  const extensions = useMemo(() => {
    const resolvedExtensions = [...externalExtensions];

    if (!disabledExtensions?.includes("enter-key")) {
      // This factory only registers handlers; refs are read later on keyboard events.
      // oxlint-disable-next-line react/refs
      resolvedExtensions.push(createEnterKeyExtension(submit, getShortcut));
    }

    return resolvedExtensions;
  }, [externalExtensions, disabledExtensions, submit, getShortcut]);

  return <EditorWrapper {...props} extensions={extensions} />;
}

const LiteTextEditorWithRef = forwardRef(function LiteTextEditorWithRef(
  props: ILiteTextEditorProps,
  ref: React.ForwardedRef<EditorRefApi>
) {
  return <LiteTextEditor {...props} forwardedRef={ref as React.MutableRefObject<EditorRefApi | null>} />;
});

LiteTextEditorWithRef.displayName = "LiteTextEditorWithRef";

export { LiteTextEditorWithRef };
