/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import ReactMarkdown, { type Components } from "react-markdown";
import { Pencil } from "lucide-react";
import { TextArea } from "@makeplane/propel/components/text-area";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { IProject } from "@plane/types";
import { useProject } from "@/hooks/store/use-project";
import { useRefreshProjectActivities } from "./use-refresh-activities";

type DescriptionBlock = {
  type: string;
  position?: { start: { line: number }; end: { line: number } };
  data?: { hProperties?: Record<string, unknown> };
};

// CommonMark consumes blank lines between paragraphs. Keep the normal paragraph
// gap for one blank line, then add one text line for each additional blank line.
// Only inspect root paragraphs so list, quote and code structure stays untouched.
function remarkDescriptionSpacing() {
  return (tree: { children: DescriptionBlock[] }) => {
    tree.children.forEach((node, index) => {
      const previous = tree.children[index - 1];
      if (node.type !== "paragraph" || previous?.type !== "paragraph" || !node.position || !previous.position) return;
      const extraBlankLines = node.position.start.line - previous.position.end.line - 2;
      if (extraBlankLines <= 0) return;
      node.data = {
        ...node.data,
        hProperties: {
          ...node.data?.hProperties,
          style: `margin-top: calc(0.75rem + ${extraBlankLines} * 1.5rem)`,
        },
      };
    });
  };
}

const descriptionRemarkPlugins = [remarkDescriptionSpacing];

const markdownComponents: Components = {
  p: ({ node: _node, ...props }) => <p {...props} className="whitespace-pre-line" />,
  a: ({ node: _node, children, ...props }) => (
    <a {...props} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

type Props = {
  project: IProject;
  workspaceSlug: string;
  disabled: boolean;
};

export const ProjectOverviewDescription = observer(function ProjectOverviewDescription({
  project,
  workspaceSlug,
  disabled,
}: Props) {
  const { t } = useTranslation();
  const { updateProject } = useProject();
  const refreshActivities = useRefreshProjectActivities(workspaceSlug, project.id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.description ?? "");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const initialDescription = useRef(project.description ?? "");
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing && !disabled) editorRef.current?.querySelector("textarea")?.focus();
  }, [editing, disabled]);

  const startEditing = () => {
    if (disabled || saving.current) return;
    initialDescription.current = project.description ?? "";
    setDraft(initialDescription.current);
    setEditing(true);
  };

  const save = async () => {
    if (disabled || saving.current || !workspaceSlug) return;
    if (draft === initialDescription.current) {
      setEditing(false);
      return;
    }
    saving.current = true;
    setBusy(true);
    try {
      await updateProject(workspaceSlug, project.id, { description: draft });
      void refreshActivities();
      setEditing(false);
    } catch {
      setToast({ type: "error", title: t("something_went_wrong_please_try_again") });
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  if (!editing || disabled) {
    return (
      <div className="flex min-h-10 items-start gap-2 text-14 leading-6">
        <div className="[&_code]:font-mono min-w-0 flex-1 break-words text-primary [&_a]:text-accent-primary [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-2 [&_blockquote]:border-subtle [&_blockquote]:pl-4 [&_blockquote]:text-secondary [&_code]:rounded-sm [&_code]:bg-surface-2 [&_code]:px-1 [&_h1]:text-24 [&_h1]:font-semibold [&_h2]:text-20 [&_h2]:font-semibold [&_h3]:text-18 [&_h3]:font-semibold [&_h4]:font-semibold [&_h5]:font-semibold [&_h6]:font-semibold [&_li>p]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_pre]:overflow-x-auto [&_pre]:rounded-sm [&_pre]:bg-surface-2 [&_pre]:p-3 [&_pre_code]:p-0 [&_ul]:list-disc [&_ul]:pl-6 [&>*+*]:mt-3">
          {project.description ? (
            <ReactMarkdown components={markdownComponents} remarkPlugins={descriptionRemarkPlugins}>
              {project.description}
            </ReactMarkdown>
          ) : (
            <span className="text-placeholder">{t("common.click_to_add_description")}</span>
          )}
        </div>
        {!disabled && (
          <button
            type="button"
            aria-label={t("edit")}
            onClick={startEditing}
            className="focus-visible:ring-primary shrink-0 rounded-sm p-1 text-secondary outline-none hover:text-primary focus-visible:ring-2"
          >
            <Pencil className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={editorRef}
      className="min-h-10 [&_textarea]:block [&_textarea]:min-h-10 [&_textarea]:w-full [&_textarea]:resize-none [&_textarea]:rounded-none [&_textarea]:border-0 [&_textarea]:p-0 [&_textarea]:text-14 [&_textarea]:leading-6 [&_textarea]:placeholder:text-placeholder"
    >
      <TextArea
        size="xl"
        surface="inline"
        autoResize
        rows={1}
        aria-label={t("description")}
        placeholder={t("common.click_to_add_description")}
        value={draft}
        disabled={disabled || busy}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void save()}
      />
    </div>
  );
});
