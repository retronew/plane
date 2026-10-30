import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Button } from "@makeplane/propel/components/button";
import { Input } from "@makeplane/propel/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";
import { useTranslation } from "@plane/i18n";
import { useEditorRef } from "platejs/react";
import type { TMentionHandler, TMentionSection, TMentionSuggestion } from "../types";
export const PlateMentionContext = createContext<TMentionHandler | null>(null);
export function MentionPicker() {
  const handler = useContext(PlateMentionContext);
  const editor = useEditorRef();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sections, setSections] = useState<TMentionSection[]>([]);
  const [error, setError] = useState(false);
  const saved = useRef(editor.selection);
  useEffect(() => {
    if (!open || !handler?.searchCallback) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      void handler.searchCallback!(query)
        .then((value) => {
          if (!cancelled) {
            setSections(value);
            setError(false);
          }
          return value;
        })
        .catch(() => {
          if (!cancelled) {
            setSections([]);
            setError(true);
          }
        });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [open, query, handler]);
  const insert = (item: TMentionSuggestion) => {
    if (saved.current) editor.tf.select(saved.current);
    editor.tf.insertNodes({
      type: "comparison_mention",
      id: item.id,
      entity_identifier: item.entity_identifier,
      entity_name: item.entity_name,
      label: item.title,
      children: [{ text: "" }],
    });
    editor.tf.insertText(" ");
    setOpen(false);
    editor.tf.focus();
  };
  if (!handler?.searchCallback) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            size="sm"
            stretch="auto"
            variant="ghost"
            label="@"
            aria-label={t("mention")}
            onMouseDown={(event) => {
              event.preventDefault();
              saved.current = editor.selection;
            }}
          />
        }
      />
      <PopoverContent>
        <div className="flex max-h-72 min-w-64 flex-col gap-1 overflow-auto p-2">
          <Input size="md" value={query} aria-label={t("search")} onChange={(event) => setQuery(event.target.value)} />
          {error && <p role="alert">{t("error")}</p>}
          {sections.map((section) => (
            <div key={section.key}>
              {section.title && <p className="text-12 text-secondary">{section.title}</p>}
              {section.items.map((item) => (
                <Button
                  key={`${item.entity_name}:${item.entity_identifier}`}
                  size="sm"
                  stretch="auto"
                  variant="ghost"
                  label={item.title}
                  onClick={() => insert(item)}
                />
              ))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
