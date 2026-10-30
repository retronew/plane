// oxlint-disable-next-line import/no-unassigned-import -- Editor styles.
import "./plate-comparison.css";
import { DisabledPlateFeatures, isPlateFeatureDisabled } from "./capabilities";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type ComponentType } from "react";
import { Plate, PlateContent, usePlateEditor, type PlateElementProps } from "platejs/react";
import { DndPlugin } from "@platejs/dnd";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useTranslation } from "@plane/i18n";
import { htmlToSlate, slateToHtml } from "../plate-headless";
import { CORE_EXTENSIONS } from "../constants/extension";
import { NodeApi, type TElement } from "platejs";
import type { EditorRefApi, TEditorAsset } from "../types";
import { useEditorPreferences } from "../components/editor-preferences";
import type { PlateEditorProps, PlateComparisonEditorLabels } from "./types";
import { comparisonPlugins, comparisonEditableComponents, comparisonCommandLabels } from "./plate-kit";
import { SelectionToolbar } from "./selection-toolbar";
import { SandboxAssetsProvider, insertSandboxImage, type SandboxImageLabels } from "./image-plugin";
import { useEditorAssets } from "./assets";
import { PlateMentionContext } from "./mentions";
import { opaquePlugins } from "./opaque";
import { withBlockHandle } from "./draggable-block";
import { legacyJSONToSlate } from "./legacy-json";
import { createPlateRef } from "./ref";
import { useComparisonCollaboration, RemoteComparisonCursors } from "./collaboration-session";
import { replaceSharedValue } from "./collaboration";
import { shouldSubmitComment } from "./keyboard";
import { SlashMenu } from "./slash-menu";

const draggable = new Set([
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
const components = Object.fromEntries(
  Object.entries(comparisonEditableComponents).map(([key, component]) => [
    key,
    draggable.has(key) ? withBlockHandle(component as ComponentType<PlateElementProps>) : component,
  ])
);
export const PlateEditorWithRef = forwardRef<EditorRefApi, PlateEditorProps>(
  function PlateEditorWithRef(props, forwardedRef) {
    const { t } = useTranslation();
    const preferences = useEditorPreferences();
    const assets = useEditorAssets(props.fileHandler);
    const container = useRef<HTMLDivElement>(null);
    const editor = usePlateEditor({
      id: props.id,
      plugins: [...comparisonPlugins, ...opaquePlugins, ...(props.dragDropEnabled ? [DndPlugin] : [])],
      override: { components: props.dragDropEnabled ? components : comparisonEditableComponents },
      value: () =>
        props.collaboration
          ? [{ type: "p", children: [{ text: "" }] }]
          : props.documentValue
            ? legacyJSONToSlate(props.documentValue)
            : htmlToSlate(props.value ?? props.initialValue),
    });
    const collab = useComparisonCollaboration(editor, props.collaboration, container);
    const readOnly = !props.editable || Boolean(props.collaboration && collab.status !== "synced");
    const suppressed = useRef(false);
    const lastHtml = useRef(slateToHtml(editor.children));
    const replace = (value: typeof editor.children, emit: boolean) => {
      if (props.collaboration && collab.status !== "synced")
        throw new Error("Collaborative editor is not synchronized");
      suppressed.current = !emit;
      if (collab.session) replaceSharedValue(collab.session.editor, value);
      else editor.tf.setValue(value);
      if (!emit) {
        lastHtml.current = slateToHtml(value);
        queueMicrotask(() => {
          suppressed.current = false;
        });
      }
    };
    const latest = useRef({ props, replace });
    useEffect(() => {
      latest.current = { props, replace };
    });
    // oxlint-disable-next-line react/refs -- Ref callbacks read the current handlers only when invoked.
    const ref = useMemo(
      () =>
        createPlateRef(
          editor,
          assets,
          // oxlint-disable-next-line react/refs -- Invoked by imperative consumers after render.
          (value, emit) => latest.current.replace(value, emit),
          () => collab.provider.current,
          // oxlint-disable-next-line react/refs -- Lazy imperative capability check.
          () => latest.current.props.disabledExtensions
        ),
      [editor, assets, collab.provider]
    );
    useImperativeHandle(forwardedRef, () => ref.api, [ref]);
    useImperativeHandle(props.forwardedRef, () => ref.api, [ref]);
    useEffect(() => () => ref.dispose(), [ref]);
    const { handleEditorReady, collaboration, autofocus } = props;
    useEffect(() => {
      handleEditorReady?.(!readOnly || !collaboration);
    }, [readOnly, collaboration, handleEditorReady]);
    useEffect(() => {
      if (autofocus && !readOnly) editor.tf.focus();
    }, [autofocus, readOnly, editor]);
    useEffect(() => {
      if (props.collaboration) return;
      const value = props.documentValue
        ? legacyJSONToSlate(props.documentValue)
        : typeof props.value === "string"
          ? htmlToSlate(props.value)
          : null;
      if (value && slateToHtml(value) !== slateToHtml(editor.children)) {
        suppressed.current = true;
        editor.tf.setValue(value);
        lastHtml.current = slateToHtml(value);
      }
    }, [editor, props.documentValue, props.value, props.collaboration]);
    const onChange = () => {
      collab.onChange();
      ref.notify();
      props.onTransaction?.();
      const html = slateToHtml(editor.children);
      if (html === lastHtml.current) {
        suppressed.current = false;
        return;
      }
      lastHtml.current = html;
      if (suppressed.current) {
        suppressed.current = false;
        return;
      }
      props.onChange?.(ref.api.getDocument().json ?? {}, html);
      const imageAssets: TEditorAsset[] = [];
      for (const [node] of NodeApi.nodes<TElement>({ type: "root", children: editor.children })) {
        if (node.type === "sandboxImage" && typeof node.src === "string")
          imageAssets.push({
            type: CORE_EXTENSIONS.CUSTOM_IMAGE,
            id: String(node.id ?? node.src),
            src: node.src,
            href: assets.get(node.src) ?? "",
            name: String(node.alt ?? ""),
          });
      }
      props.onAssetChange?.(imageAssets);
    };
    const labels = Object.fromEntries(
      [...Object.keys(comparisonCommandLabels), "editor", "toolbar", "undo", "redo"].map((key) => [
        key,
        t(`editor_comparison.${key}` as Parameters<typeof t>[0]),
      ])
    ) as PlateComparisonEditorLabels;
    const imageLabels = Object.fromEntries(
      [
        "upload",
        "width",
        "alt",
        "alignLeft",
        "alignCenter",
        "alignRight",
        "remove",
        "preview",
        "previousImage",
        "nextImage",
        "closePreview",
        "unavailable",
        "uploadError",
      ].map((key) => [key, t(`editor_comparison.${key}` as Parameters<typeof t>[0])])
    ) as SandboxImageLabels;
    imageLabels.imagePosition = t("editor_comparison.imagePosition", { index: "{index}", total: "{total}" });
    const placeholder =
      typeof props.placeholder === "function"
        ? props.placeholder(editor.api.isFocused(), ref.api.getDocument().html)
        : props.placeholder;
    return (
      <SandboxAssetsProvider assets={assets} labels={imageLabels}>
        <PlateMentionContext.Provider value={props.mentionHandler}>
          <DisabledPlateFeatures.Provider value={props.disabledExtensions}>
            <div
              className={`editor-container ${props.containerClassName ?? ""} ${props.displayConfig?.fontSize ?? "small-font"} ${props.displayConfig?.fontStyle ?? "sans-serif"}`}
            >
              <DndProvider backend={HTML5Backend}>
                <Plate editor={editor} readOnly={readOnly} onChange={onChange} onSelectionChange={collab.onChange}>
                  {!readOnly && props.toolbar !== "none" && props.bubbleMenuEnabled !== false && (
                    <SelectionToolbar labels={labels} />
                  )}
                  {!readOnly && <SlashMenu api={ref.api} disabled={props.disabledExtensions} />}
                  <div ref={container} className="relative">
                    <PlateContent
                      aria-label={placeholder || props.id}
                      placeholder={placeholder}
                      readOnly={readOnly}

                      tabIndex={props.tabIndex}
                      className={`plate-comparison-content ${props.mode === "document" ? "min-h-dvh pb-64" : props.mode === "rich" ? "min-h-32" : "min-h-12"} outline-none ${props.editorClassName ?? ""}`}
                      onMouseDown={(event) => {
                        if (
                          readOnly ||
                          (props.mode !== "document" && props.mode !== "rich") ||
                          event.button !== 0 ||
                          event.target !== event.currentTarget
                        )
                          return;
                        const last = event.currentTarget.lastElementChild;
                        if (last && event.clientY > last.getBoundingClientRect().bottom) {
                          event.preventDefault();
                          const end = editor.api.end([]);
                          if (end) editor.tf.select(end);
                          editor.tf.focus();
                        }
                      }}
                      onFocus={() => props.onEditorFocus?.()}
                      onKeyDownCapture={(event) => {
                        const block = editor.api.block()?.[0];
                        const blocked = block?.type === "code_line" || Boolean(block?.listStyleType);
                        if (
                          props.mode === "lite" &&
                          props.onEnterKeyPress &&
                          !props.disabledExtensions.includes("enter-key") &&
                          shouldSubmitComment(
                            event.nativeEvent,
                            props.useCommentSubmitShortcut ? preferences.commentSubmitShortcut : "enter",
                            blocked
                          )
                        ) {
                          event.preventDefault();
                          props.onEnterKeyPress(event);
                        }
                      }}
                      onPaste={(event) => {
                        const files = Array.from(event.clipboardData.files).filter((file) =>
                          file.type.startsWith("image/")
                        );
                        if (!readOnly && !isPlateFeatureDisabled(props.disabledExtensions, "image") && files.length) {
                          event.preventDefault();
                          void Promise.all(files.map((file) => insertSandboxImage(editor, assets, file)));
                        }
                      }}
                      onDrop={(event) => {
                        const files = Array.from(event.dataTransfer.files).filter((file) =>
                          file.type.startsWith("image/")
                        );
                        if (!readOnly && !isPlateFeatureDisabled(props.disabledExtensions, "image") && files.length) {
                          event.preventDefault();
                          void Promise.all(files.map((file) => insertSandboxImage(editor, assets, file)));
                        }
                      }}
                    />
                    {!props.disabledExtensions.includes("collaboration-cursor") && (
                      <RemoteComparisonCursors cursors={collab.cursors} />
                    )}
                  </div>
                </Plate>
              </DndProvider>
            </div>
          </DisabledPlateFeatures.Provider>
        </PlateMentionContext.Provider>
      </SandboxAssetsProvider>
    );
  }
);
export function PlateReadOnly(props: PlateEditorProps) {
  return <PlateEditorWithRef {...props} editable={false} toolbar="none" />;
}
