import { useState } from "react";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import {
  Dialog,
  DialogContent,
  DialogMain,
  DialogHeader,
  DialogHeading,
  DialogTitle,
  DialogBody,
  DialogActions,
} from "@makeplane/propel/components/dialog";
import { AddOutline, ChevronDownOutline, EditOutline, DeleteOutline } from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
import type { TemplateWorkItemChild } from "@/services/workspace-configuration.service";
import { TemplateWorkItemFields } from "./work-item-fields";

const emptyChild = (): TemplateWorkItemChild => ({
  client_id: crypto.randomUUID(),
  name: "",
  description_html: "<p></p>",
  priority: "none",
});

export function TemplateChildren({
  items,
  onChange,
  workspaceSlug,
  projectId,
  disabled,
}: {
  items: TemplateWorkItemChild[];
  onChange: (items: TemplateWorkItemChild[]) => void;
  workspaceSlug: string;
  projectId: string;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<TemplateWorkItemChild>(emptyChild);
  const edit = (item?: TemplateWorkItemChild, index?: number) => {
    setEditingIndex(index ?? null);
    setDraft(item ? { ...item } : emptyChild());
    setOpen(true);
  };
  const save = () => {
    if (!draft.name.trim()) return;
    const child = { ...draft, name: draft.name.trim() };
    onChange(editingIndex === null ? [...items, child] : items.map((item, i) => (i === editingIndex ? child : item)));
    setOpen(false);
    setExpanded(true);
  };
  return (
    <>
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="flex min-h-8 items-center gap-2 rounded-sm text-13 font-medium focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:outline-none"
            aria-expanded={expanded}
            aria-controls="template-children"
            onClick={() => setExpanded((value) => !value)}
          >
            <ChevronDownOutline className={`size-3.5 ${expanded ? "" : "-rotate-90"}`} />
            {t("web.template_sub_work_items")}
            {items.length > 0 && <span className="text-tertiary">{items.length}</span>}
          </button>
          <IconButton
            variant="ghost"
            size="sm"
            icon={<AddOutline className="size-4" />}
            aria-label={t("web.project_template_add_child")}
            disabled={disabled || items.length >= 50}
            onClick={() => edit()}
          />
        </div>
        <div id="template-children" hidden={!expanded}>
          {items.length > 0 && (
            <ul className="divide-y divide-subtle rounded-md border border-subtle">
              {items.map((item, index) => (
                <li key={item.client_id} className="flex items-center gap-3 px-3 py-2">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => edit(item, index)}
                    className="min-w-0 flex-1 truncate text-left text-13 hover:text-accent-primary"
                  >
                    {item.name}
                  </button>
                  <IconButton
                    variant="ghost"
                    size="sm"
                    icon={<EditOutline className="size-3.5" />}
                    aria-label={t("web.project_template_edit_child")}
                    disabled={disabled}
                    onClick={() => edit(item, index)}
                  />
                  <IconButton
                    variant="ghost"
                    size="sm"
                    icon={<DeleteOutline className="size-3.5" />}
                    aria-label={t("delete")}
                    disabled={disabled}
                    onClick={() => onChange(items.filter((_, i) => i !== index))}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg">
          <DialogMain>
            <DialogHeader>
              <DialogHeading>
                <DialogTitle>
                  {t(editingIndex === null ? "web.project_template_add_child" : "web.project_template_edit_child")}
                </DialogTitle>
              </DialogHeading>
            </DialogHeader>
            <DialogBody>
              <TemplateWorkItemFields
                key={draft.client_id}
                value={draft}
                onChange={(patch) => setDraft((value) => ({ ...value, ...patch }))}
                workspaceSlug={workspaceSlug}
                projectId={projectId}
                id="template-child"
              />
            </DialogBody>
          </DialogMain>
          <DialogActions>
            <Button size="md" stretch="auto" variant="secondary" label={t("cancel")} onClick={() => setOpen(false)} />
            <Button
              size="md"
              stretch="auto"
              variant="primary"
              label={t("save")}
              disabled={!draft.name.trim()}
              onClick={save}
            />
          </DialogActions>
        </DialogContent>
      </Dialog>
    </>
  );
}
