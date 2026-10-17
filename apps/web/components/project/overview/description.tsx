/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { Button } from "@makeplane/propel/components/button";
import { TextArea } from "@makeplane/propel/components/text-area";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { IProject } from "@plane/types";
import { useProject } from "@/hooks/store/use-project";
import { useRefreshProjectActivities } from "./use-refresh-activities";

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
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing && !disabled) editorRef.current?.querySelector("textarea")?.focus();
  }, [editing, disabled]);

  const startEditing = () => {
    if (disabled || saving.current) return;
    setDraft(project.description ?? "");
    setEditing(true);
  };

  const cancel = () => {
    if (saving.current) return;
    setDraft(project.description ?? "");
    setEditing(false);
  };

  const save = async () => {
    if (disabled || saving.current || !workspaceSlug) return;
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
      <button
        type="button"
        disabled={disabled}
        onClick={startEditing}
        className="focus-visible:ring-primary block min-h-10 w-full rounded-sm text-left text-14 outline-none focus-visible:ring-2 disabled:cursor-default"
      >
        <p className={`break-words whitespace-pre-wrap ${project.description ? "text-primary" : "text-placeholder"}`}>
          {project.description || t("common.click_to_add_description")}
        </p>
      </button>
    );
  }

  return (
    <div
      ref={editorRef}
      className="flex flex-col gap-3 [&_textarea]:min-h-10 [&_textarea]:w-full [&_textarea]:text-14 [&_textarea]:leading-relaxed"
    >
      <TextArea
        size="xl"
        surface="inline"
        autoResize
        rows={2}
        aria-label={t("description")}
        placeholder={t("common.click_to_add_description")}
        value={draft}
        disabled={disabled || busy}
        onChange={(event) => setDraft(event.target.value)}
      />
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          stretch="auto"
          label={t(busy ? "saving" : "save")}
          loading={busy}
          disabled={disabled || busy}
          onClick={() => void save()}
        />
        <Button variant="ghost" size="sm" stretch="auto" label={t("cancel")} disabled={busy} onClick={cancel} />
      </div>
    </div>
  );
});
