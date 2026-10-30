import { isPlateFeatureDisabled } from "./capabilities";
import { useEffect, useState } from "react";
import { Input } from "@makeplane/propel/components/input";
import { Button } from "@makeplane/propel/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";
import { EmojiPicker, stringToEmoji } from "@plane/blocks/emoji-icon-picker";
import { useTranslation } from "@plane/i18n";
import { useEditorRef } from "platejs/react";
import { MentionPicker } from "./mentions";
import { executeComparisonCommand } from "./plate-kit";
import type { EditorRefApi, TAIHandler } from "../types";
const NO_DISABLED: string[] = [];
export function InsertMenu({
  api,
  aiHandler,
  disabled = NO_DISABLED,
}: {
  api: EditorRefApi;
  aiHandler?: TAIHandler;
  disabled?: string[];
}) {
  const editor = useEditorRef();
  const { t } = useTranslation();
  const [emoji, setEmoji] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [url, setUrl] = useState("");
  useEffect(() => {
    const listener = (event: Event) => {
      const command = (event as CustomEvent<string>).detail;
      if (command === "emoji") setEmoji(true);
    };
    document.addEventListener(`plate-command:${editor.id}`, listener);
    return () => document.removeEventListener(`plate-command:${editor.id}`, listener);
  }, [editor]);
  return (
    <div className="flex items-center gap-1">
      <Popover>
        <PopoverTrigger
          render={
            <Button
              size="sm"
              stretch="auto"
              variant="ghost"
              label="+"
              aria-label={t("editor_comparison.commands")}
              onMouseDown={(event) => event.preventDefault()}
            />
          }
        />
        <PopoverContent>
          <div className="flex max-h-72 flex-col overflow-auto p-2">
            {(["table", "codeBlock", "horizontalRule", "callout", "todoList"] as const)
              .filter((command) => !isPlateFeatureDisabled(disabled, command))
              .map((command) => (
                <Button
                  key={command}
                  size="sm"
                  stretch="auto"
                  variant="ghost"
                  label={t(`editor_comparison.${command}`)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    executeComparisonCommand(editor, command);
                    editor.tf.focus();
                  }}
                />
              ))}
            <Button
              size="sm"
              stretch="auto"
              variant="ghost"
              disabled={isPlateFeatureDisabled(disabled, "image")}
              label={t("editor_comparison.image")}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => api.executeMenuItemCommand({ itemKey: "image", savedSelection: null })}
            />
            <Button
              size="sm"
              stretch="auto"
              variant="ghost"
              disabled={isPlateFeatureDisabled(disabled, "attachment")}
              label={t("attachment")}
              onClick={() => api.executeMenuItemCommand({ itemKey: "attachment", savedSelection: null })}
            />
            {!isPlateFeatureDisabled(disabled, "mention") && <MentionPicker />}
            {aiHandler?.menu && !isPlateFeatureDisabled(disabled, "ai") && (
              <Button size="sm" stretch="auto" variant="ghost" label="Plane AI" onClick={() => setAiOpen(true)} />
            )}
            {!isPlateFeatureDisabled(disabled, "emoji") && (
              <EmojiPicker
                isOpen={emoji}
                handleToggle={setEmoji}
                label={t("editor_comparison.emoji")}
                onChange={(selection) => {
                  if (selection.type === "emoji") {
                    editor.tf.insertText(stringToEmoji(selection.value));
                    editor.tf.focus();
                  }
                }}
              />
            )}
          </div>
        </PopoverContent>
      </Popover>
      <Popover open={embedOpen} onOpenChange={setEmbedOpen}>
        <PopoverTrigger
          render={
            <Button
              size="sm"
              stretch="auto"
              variant="ghost"
              label={t("editor_comparison.link")}
              onMouseDown={(event) => event.preventDefault()}
            />
          }
        />
        <PopoverContent>
          <div className="flex flex-col gap-2 p-2">
            <Input
              size="md"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              aria-label={t("editor_comparison.linkUrl")}
            />
            <Button
              size="sm"
              stretch="auto"
              variant="primary"
              label={t("editor_comparison.apply")}
              disabled={!/^https?:\/\//i.test(url)}
              onClick={() => {
                editor.tf.insertNodes({ type: "p", children: [{ type: "a", url, children: [{ text: url }] }] });
                setEmbedOpen(false);
                editor.tf.focus();
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
      {aiHandler?.menu?.({ isOpen: aiOpen, onClose: () => setAiOpen(false) })}
    </div>
  );
}
