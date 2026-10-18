/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Node } from "@tiptap/pm/model";
import { UnlinkOutline } from "@makeplane/propel/icons";
import { useCallback, useEffect, useId, useRef, useState } from "react";
// components
import type { LinkViewProps, LinkViews } from "@/components/links";
// helpers
import { isValidHttpUrl } from "@/helpers/common";
import { translate } from "@plane/i18n";

type InputViewProps = {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
};

function InputView({ label, value, placeholder, onChange, autoFocus }: InputViewProps) {
  const inputId = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="inline-block text-11 font-semibold text-placeholder">
        {label}
      </label>
      <input
        id={inputId}
        placeholder={placeholder}
        onClick={(e) => e.stopPropagation()}
        className="w-[280px] rounded-md border border-strong bg-layer-1 p-2 text-13 text-primary outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- focus the input as soon as the link editor opens
        autoFocus={autoFocus}
      />
    </div>
  );
}

type LinkEditViewProps = {
  viewProps: LinkViewProps;
  switchView: (view: LinkViews) => void;
};

export function LinkEditView({ viewProps }: LinkEditViewProps) {
  const { editor, from, to, url: initialUrl, text: initialText, closeLinkView } = viewProps;

  // State
  const [positionRef] = useState({ from, to });
  const [urlDraft, setUrlDraft] = useState({ source: initialUrl, value: initialUrl });
  const localUrl = urlDraft.source === initialUrl ? urlDraft.value : initialUrl;
  const setLocalUrl = useCallback((value: string) => setUrlDraft({ source: initialUrl, value }), [initialUrl]);
  const [textDraft, setTextDraft] = useState({ source: initialText, value: initialText ?? "" });
  const localText = textDraft.source === initialText ? textDraft.value : (initialText ?? "");
  const setLocalText = useCallback((value: string) => setTextDraft({ source: initialText, value }), [initialText]);
  const [linkRemoved, setLinkRemoved] = useState(false);
  const hasSubmitted = useRef(false);

  const removeLink = useCallback(() => {
    editor.view.dispatch(editor.state.tr.removeMark(from, to, editor.schema.marks.link));
    setLinkRemoved(true);
    closeLinkView();
  }, [editor, from, to, closeLinkView]);

  // Effects
  useEffect(
    () =>
      // Cleanup effect: Remove link if not submitted and url is empty
      () => {
        if (!hasSubmitted.current && !linkRemoved && initialUrl === "") {
          try {
            removeLink();
          } catch (e) {
            console.error("Error removing link", e);
          }
        }
      },
    [removeLink, linkRemoved, initialUrl]
  );

  // Handlers
  const handleTextChange = useCallback(
    (value: string) => {
      if (value.trim() !== "") setLocalText(value);
    },
    [setLocalText]
  );

  const applyChanges = useCallback((): boolean => {
    if (linkRemoved) return false;
    hasSubmitted.current = true;

    const { url, isValid } = isValidHttpUrl(localUrl);
    if (to >= editor.state.doc.content.size || !isValid) return false;

    // Apply URL change
    const tr = editor.state.tr;
    tr.removeMark(from, to, editor.schema.marks.link).addMark(from, to, editor.schema.marks.link.create({ href: url }));
    editor.view.dispatch(tr);

    // Apply text change if different
    if (localText !== initialText) {
      const node = editor.view.state.doc.nodeAt(from) as Node;
      if (!node || !node.marks) return false;

      editor
        .chain()
        .setTextSelection(from)
        .deleteRange({ from: positionRef.from, to: positionRef.to })
        .insertContent(localText)
        .setTextSelection({ from, to: from + localText.length })
        .run();
      //
      // Restore marks
      node.marks.forEach((mark) => {
        editor.chain().setMark(mark.type.name, mark.attrs).run();
      });
    }

    return true;
  }, [linkRemoved, positionRef, editor, from, to, initialText, localText, localUrl]);

  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- mouse-only backdrop/list interaction; keyboard handled by the editor or Esc
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (applyChanges()) closeLinkView();
      }}
      className="shadow-md animate-in fade-in flex translate-y-1 flex-col gap-3 rounded-sm border-2 border-subtle bg-layer-1 p-2"
      style={{
        transition: "opacity 0.1s cubic-bezier(.55, .085, .68, .53)",
      }}
    >
      <InputView
        label="URL"
        placeholder={translate("web.enter_or_paste_url")}
        value={localUrl}
        onChange={setLocalUrl}
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- focus the input as soon as the link editor opens
        autoFocus
      />
      <InputView
        label={translate("web.text")}
        placeholder={translate("web.enter_text_to_display")}
        value={localText}
        onChange={handleTextChange}
      />
      <button type="submit" className="sr-only">
        {translate("save")}
      </button>
      <div className="bg-strong mb-1 h-[1px] w-full gap-2" />
      <div className="flex items-center gap-2 text-13 text-secondary">
        <UnlinkOutline width={14} height={14} className="inline-block" />
        <button type="button" onClick={removeLink} className="cursor-pointer transition-colors hover:text-placeholder">
          {translate("web.remove_link")}
        </button>
      </div>
    </form>
  );
}
