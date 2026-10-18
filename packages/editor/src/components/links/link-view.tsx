/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Editor } from "@tiptap/react";
import type { CSSProperties } from "react";
import { useState } from "react";
// components
import { LinkEditView, LinkPreview } from "@/components/links";

export type LinkViews = "LinkPreview" | "LinkEditView";

export type LinkViewProps = {
  view?: LinkViews;
  editor: Editor;
  from: number;
  to: number;
  url: string;
  text?: string;
  closeLinkView: () => void;
};

export function LinkView(props: LinkViewProps & { style: CSSProperties }) {
  const [selection, setSelection] = useState({ from: props.from, view: props.view ?? "LinkPreview" });
  const currentView = selection.from === props.from ? selection.view : "LinkPreview";
  const switchView = (view: LinkViews) => setSelection({ from: props.from, view });

  return (
    <>
      {currentView === "LinkPreview" && <LinkPreview viewProps={props} switchView={switchView} />}
      {currentView === "LinkEditView" && <LinkEditView viewProps={props} switchView={switchView} />}
    </>
  );
}
