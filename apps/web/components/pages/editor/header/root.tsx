/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import type { EditorTitleRefApi } from "@plane/editor";
import { setToast } from "@plane/blocks/toast";
import { TemplatePicker } from "@/components/settings/workspace/configuration/template-picker";
import { getPageTemplatePatch } from "@/components/settings/workspace/configuration/template-application";
import type { WorkspaceTemplate } from "@/services/workspace-configuration.service";
// store
import type { TPageInstance } from "@/store/pages/base-page";
// local imports
import { PageEditorHeaderLogoPicker } from "./logo-picker";
import { translate } from "@plane/i18n";

type Props = {
  page: TPageInstance;
  projectId?: string;
  workspaceSlug: string;
  titleEditorRef: React.RefObject<EditorTitleRefApi | null>;
};

export const PageEditorHeaderRoot = observer(function PageEditorHeaderRoot(props: Props) {
  const { page, projectId, workspaceSlug, titleEditorRef } = props;
  // states
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);
  const applyingTemplate = useRef(false);
  // derived values
  const { isContentEditable } = page;

  const applyTemplate = async (template: WorkspaceTemplate) => {
    const editor = page.editor.editorRef;
    const titleEditor = titleEditorRef.current;
    if (!page.isContentEditable || !editor || !titleEditor || applyingTemplate.current) return;
    applyingTemplate.current = true;
    setIsApplyingTemplate(true);
    try {
      const { description_html, ...properties } = getPageTemplatePatch(template);
      await page.update(properties);
      if (!page.isContentEditable) return;
      // Title templates are plain text; escape them before passing HTML to Tiptap.
      const title = document.createElement("span");
      title.textContent = properties.name;
      titleEditor.setEditorValue(`<h1>${title.innerHTML}</h1>`);
      editor.setEditorValue(description_html, true);
    } catch (error) {
      console.error("Failed to apply page template", error);
      setToast({ type: "error", title: translate("web.failed_to_save_page") });
    } finally {
      applyingTemplate.current = false;
      setIsApplyingTemplate(false);
    }
  };

  return (
    <>
      <div className="flex h-[48px] items-end gap-1 text-left">
        <PageEditorHeaderLogoPicker page={page} />
        {isContentEditable && (
          <TemplatePicker
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            kind="page"
            variant="page"
            disabled={isApplyingTemplate || !page.editor.editorRef}
            onApply={(template) => void applyTemplate(template)}
          />
        )}
      </div>
    </>
  );
});
