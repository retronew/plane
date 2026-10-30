// oxlint-disable-next-line import/no-unassigned-import -- Scoped editor styles.
import "./plate-comparison.css";
import { replaceSharedValue, type ComparisonRoom } from "./collaboration";
import { useComparisonCollaboration, RemoteComparisonCursors } from "./collaboration-session";
import type { TDisplayConfig } from "@plane/editor";
import { useTranslation } from "@plane/i18n";
import { EmojiPicker, stringToEmoji } from "@plane/blocks/emoji-icon-picker";
import { MarkdownPlugin } from "@platejs/markdown";
import { forwardRef, useImperativeHandle, useState, useRef, type ComponentType } from "react";
import type { PlateElementProps } from "platejs/react";
import { SelectionToolbar, SelectionToolbarControls } from "./selection-toolbar";
import { DndPlugin } from "@platejs/dnd";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { withBlockHandle } from "./draggable-block";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { AtSign, ImagePlus, IndentIncrease, IndentDecrease, Undo2, Redo2, Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";
import { insertSandboxImage, useSandboxAssetsContext } from "./image-plugin";
import { Button } from "@makeplane/propel/components/button";
import { Plate, PlateContent, useEditorRef, useEditorSelector, usePlateEditor } from "platejs/react";
import {
  comparisonEditableComponents,
  comparisonCommandLabels,
  executeComparisonCommand,
  comparisonPlugins,
  deserializeComparisonHtml,
  serializeComparisonHtml,
} from "./plate-kit";

export interface PlateComparisonEditorHandle {
  getHtml(): Promise<string>;
  setHtml(html: string): void;
  setMarkdown(markdown: string): void;
}

export interface PlateComparisonEditorLabels extends Partial<Record<keyof typeof comparisonCommandLabels, string>> {
  editor: string;
  toolbar: string;
  bold: string;
  italic: string;
  underline: string;
  strikethrough: string;
  code: string;
  paragraph: string;
  heading1: string;
  heading2: string;
  blockquote: string;
  undo: string;
  redo: string;
}

export interface PlateComparisonEditorProps {
  initialValue: string;
  collaboration?: ComparisonRoom;
  displayConfig?: TDisplayConfig;
  labels: PlateComparisonEditorLabels;
}

function ComparisonToolbar({
  labels: providedLabels,
  disabled,
  history,
}: {
  labels: PlateComparisonEditorLabels;
  disabled?: boolean;
  history?: { undo: boolean; redo: boolean };
}) {
  const labels = { ...comparisonCommandLabels, ...providedLabels };
  const [uploadError, setUploadError] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const assets = useSandboxAssetsContext();
  const editor = useEditorRef();
  const canUndo = useEditorSelector((current) => current.history.undos.length > 0, []);
  const canRedo = useEditorSelector((current) => current.history.redos.length > 0, []);
  return (
    <fieldset
      disabled={disabled}
      aria-label={labels.toolbar}
      className="flex min-w-0 flex-wrap items-center gap-1 border-b border-subtle p-1"
    >
      <div className="flex gap-0.5 border-r border-subtle pr-1">
        {(["undo", "redo"] as const).map((key) => (
          <span key={key}>
            <IconButton
              size="sm"
              variant="ghost"
              aria-label={labels[key]}
              icon={key === "undo" ? <Undo2 className="size-4" /> : <Redo2 className="size-4" />}
              disabled={key === "undo" ? !(history?.undo ?? canUndo) : !(history?.redo ?? canRedo)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                editor.tf[key]();
                editor.tf.focus();
              }}
            />
          </span>
        ))}
      </div>
      <SelectionToolbarControls labels={providedLabels} />
      <div className="flex items-center gap-0.5 border-l border-subtle pl-1">
        {(["outdent", "indent"] as const).map((command) => (
          <span key={command}>
            <IconButton
              size="sm"
              variant="ghost"
              aria-label={labels[command]}
              icon={
                command === "indent" ? <IndentIncrease className="size-4" /> : <IndentDecrease className="size-4" />
              }
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                executeComparisonCommand(editor, command);
                editor.tf.focus();
              }}
            />
          </span>
        ))}
        <WritingHelpers />
        <span>
          <IconButton
            size="sm"
            variant="ghost"
            aria-label={labels.image}
            icon={<ImagePlus className="size-4" />}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => imageInput.current?.click()}
          />
        </span>
      </div>
      <input
        ref={imageInput}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={labels.image}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setUploadError(false);
          try {
            await insertSandboxImage(editor, assets, file);
          } catch {
            setUploadError(true);
          }
        }}
      />
      {uploadError && (
        <span role="alert" className="text-danger-primary">
          {labels.uploadFailed}
        </span>
      )}
    </fieldset>
  );
}

function WritingHelpers() {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const editor = useEditorRef();
  const { t } = useTranslation();
  return (
    <>
      <Popover>
        <span>
          <PopoverTrigger
            render={
              <IconButton
                size="sm"
                variant="ghost"
                aria-label={t("editor_comparison.mention")}
                icon={<AtSign className="size-4" />}
                onMouseDown={(event) => event.preventDefault()}
              />
            }
          />
        </span>
        <PopoverContent>
          <div className="flex flex-col gap-1 p-2">
            {[
              { id: "demo-alex", name: "Alex" },
              { id: "demo-lin", name: "林" },
            ].map((member) => (
              <Button
                key={member.id}
                type="button"
                size="sm"
                stretch="auto"
                variant="ghost"
                label={`@${member.name}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  editor.tf.insertNodes({
                    type: "comparison_mention",
                    id: member.name,
                    entity_identifier: member.id,
                    entity_name: "user_mention",
                    children: [{ text: "" }],
                  });
                  editor.tf.insertText(" ");
                  editor.tf.focus();
                }}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <EmojiPicker
        isOpen={emojiOpen}
        handleToggle={setEmojiOpen}
        label={
          <Tooltip label={t("editor_comparison.emoji")}>
            <span className="inline-flex">
              <Smile className="size-4" />
            </span>
          </Tooltip>
        }
        onChange={(selection) => {
          if (selection.type !== "emoji") return;
          editor.tf.insertText(stringToEmoji(selection.value));
          editor.tf.focus();
        }}
      />
    </>
  );
}

const draggableTypes = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "table",
  "code_block",
  "hr",
  "comparison_callout",
  "sandboxImage",
]);
const editableComponents = Object.fromEntries(
  Object.entries(comparisonEditableComponents).map(([key, component]) => [
    key,
    draggableTypes.has(key) ? withBlockHandle(component as ComponentType<PlateElementProps>) : component,
  ])
);

export const PlateComparisonEditor = forwardRef<PlateComparisonEditorHandle, PlateComparisonEditorProps>(
  function PlateComparisonEditor({ initialValue, labels, displayConfig, collaboration }, ref) {
    const [slashOpen, setSlashOpen] = useState(false);
    const { t } = useTranslation();
    const editor = usePlateEditor({
      plugins: [...comparisonPlugins, DndPlugin],
      override: { components: editableComponents },
      value: (current) =>
        collaboration ? [{ type: "p", children: [{ text: "" }] }] : deserializeComparisonHtml(current, initialValue),
    });

    const container = useRef<HTMLDivElement>(null);
    const collab = useComparisonCollaboration(editor, collaboration, container);
    const readOnly = Boolean(collaboration && collab.status !== "synced");

    useImperativeHandle(
      ref,
      () => ({
        getHtml: () => serializeComparisonHtml(editor.children),
        setMarkdown: (markdown) => {
          const value = editor.getApi(MarkdownPlugin).markdown.deserialize(markdown);
          if (collab.session) {
            if (readOnly) throw new Error("Comparison room is not synchronized");
            replaceSharedValue(collab.session.editor, value);
            return;
          }
          editor.tf.setValue(value);
          editor.history.undos = [];
          editor.history.redos = [];
        },
        setHtml: (html) => {
          const value = deserializeComparisonHtml(editor, html);
          if (collab.session) {
            if (readOnly) throw new Error("Comparison room is not synchronized");
            replaceSharedValue(collab.session.editor, value);
            return;
          }
          editor.tf.setValue(value);
          // Import starts a new document; undo must not restore the previous input.
          editor.history.undos = [];
          editor.history.redos = [];
        },
      }),
      [editor, collab.session, readOnly]
    );

    return (
      <div
        className={`editor-container overflow-hidden rounded-lg border border-subtle bg-surface-1 ${displayConfig?.fontSize ?? "small-font"} ${displayConfig?.fontStyle ?? "sans-serif"} line-spacing-${displayConfig?.lineSpacing ?? "regular"}`}
      >
        {collaboration && (
          <div className="flex items-center gap-2 border-b border-subtle p-2">
            <output aria-live="polite">{t(`editor_comparison.connection_${collab.status}`)}</output>
            {(collab.status === "error" || collab.status === "disconnected") && (
              <Button
                size="sm"
                stretch="auto"
                variant="secondary"
                label={t("editor_comparison.retryConnection")}
                onClick={() => void collab.retry()}
              />
            )}
          </div>
        )}
        <DndProvider backend={HTML5Backend}>
          <Plate editor={editor} readOnly={readOnly} onChange={collab.onChange} onSelectionChange={collab.onChange}>
            <ComparisonToolbar
              labels={labels}
              disabled={readOnly}
              history={collaboration ? collab.history : undefined}
            />
            {!readOnly && <SelectionToolbar labels={labels} />}
            <Popover open={slashOpen} onOpenChange={setSlashOpen}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    size="sm"
                    stretch="auto"
                    variant="ghost"
                    disabled={readOnly}
                    label={t("editor_comparison.commands")}
                    onMouseDown={(event) => event.preventDefault()}
                  />
                }
              />
              <PopoverContent>
                <div className="flex max-h-72 flex-col gap-1 overflow-auto p-2">
                  {(
                    [
                      "callout",
                      "bulletedList",
                      "numberedList",
                      "todoList",
                      "codeBlock",
                      "horizontalRule",
                      "table",
                    ] as const
                  ).map((command) => (
                    <Button
                      key={command}
                      type="button"
                      size="sm"
                      stretch="auto"
                      variant="ghost"
                      label={labels[command] ?? comparisonCommandLabels[command]}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        executeComparisonCommand(editor, command);
                        setSlashOpen(false);
                        editor.tf.focus();
                      }}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <div ref={container} className="relative">
              <PlateContent
                readOnly={readOnly}
                onKeyDown={(event) => {
                  if (
                    event.key === "/" &&
                    !event.nativeEvent.isComposing &&
                    editor.api.block() &&
                    editor.api.string(editor.api.block()![1]) === ""
                  ) {
                    event.preventDefault();
                    setSlashOpen(true);
                  }
                }}
                aria-label={labels.editor}
                className="plate-comparison-content prose-sm focus-visible:ring-primary min-h-80 max-w-none p-6 text-primary prose outline-none focus-visible:ring-2 focus-visible:ring-inset"
              />
              <RemoteComparisonCursors cursors={collab.cursors} />
            </div>
          </Plate>
        </DndProvider>
      </div>
    );
  }
);
