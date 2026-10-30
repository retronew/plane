import { isPlateFeatureDisabled } from "./capabilities";
import { NodeApi, type Point, type Value } from "platejs";
import type { PlateEditor } from "platejs/react";
import * as Y from "yjs";
import { MarkdownPlugin } from "@platejs/markdown";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import { htmlToSlate, slateToHtml } from "../plate-headless";
import type { EditorRefApi, IMarking, TCollaborationUser } from "../types";
import { slateToLegacyJSON } from "./legacy-json";
import { comparisonCommandLabels, executeComparisonCommand } from "./plate-kit";
import { insertSandboxImage } from "./image-plugin";
import type { EditorAssets } from "./assets";

const unsupported = (method: string): never => {
  throw new Error(`Plate editor does not support legacy ${method}; migrate this consumer to a Slate selection API`);
};

export function createPlateRef(
  editor: PlateEditor,
  assets: EditorAssets,
  replace: (value: Value, emit: boolean) => void,
  provider: () => HocuspocusProvider | null,
  disabled: () => readonly string[] = () => []
) {
  const stateListeners = new Set<() => void>();
  const bookmarks = new Map<number, ReturnType<typeof editor.api.pointRef>>();
  let sequence = 0;
  const subscribe = (fn: () => void) => {
    stateListeners.add(fn);
    return () => {
      stateListeners.delete(fn);
    };
  };
  const headings = (): IMarking[] =>
    editor.children.flatMap((node, index) =>
      /^h[1-6]$/.test(node.type)
        ? [{ type: "heading", level: Number(node.type[1]), text: NodeApi.string(node), sequence: index }]
        : []
    );
  const info = () => {
    const text = editor.api.string([]);
    return {
      characters: text.length,
      words: text.trim() ? text.trim().split(/\s+/).length : 0,
      paragraphs: editor.children.length,
    };
  };
  const users = (): TCollaborationUser[] => {
    const result = new Map<string, TCollaborationUser>();
    provider()
      ?.awareness?.getStates()
      .forEach((state) => {
        const user = state.user;
        if (user?.id && user?.name) result.set(user.id, { id: user.id, name: user.name, avatar: user.avatar ?? null });
      });
    return [...result.values()];
  };
  const point = (position?: number): Point | undefined =>
    position === undefined ? editor.selection?.focus : (bookmarks.get(position)?.current ?? undefined);
  const coords = (position?: number) => {
    const target = point(position);
    if (!target) return undefined;
    const range = editor.api.toDOMRange({ anchor: target, focus: target });
    return range?.getBoundingClientRect();
  };
  const api: EditorRefApi = {
    getDocument: () => ({
      html: slateToHtml(editor.children),
      json: slateToLegacyJSON(editor.children),
      binary: provider() ? Y.encodeStateAsUpdate(provider()!.document) : null,
    }),
    getDocumentInfo: info,
    getHeadings: headings,
    getMarkDown: () => editor.getApi(MarkdownPlugin).markdown.serialize(),
    copyMarkdownToClipboard: () => {
      void navigator.clipboard.writeText(api.getMarkDown());
    },
    getSelectedText: () => (editor.api.isExpanded() ? slateToHtml(editor.api.fragment() as Value) : null),
    blur: () => editor.tf.blur(),
    focus: (position) => {
      if (position === "start") editor.tf.select(editor.api.start([]));
      else if (position === "end") editor.tf.select(editor.api.end([]));
      else if (typeof position === "number") {
        const at = point(position);
        if (at) editor.tf.select(at);
      }
      editor.tf.focus();
    },
    clearEditor: (emit = false) => replace([{ type: "p", children: [{ text: "" }] }], emit),
    setEditorValue: (html, emit = false) => replace(htmlToSlate(html), emit),
    setEditorValueAtCursorPosition: (html) => editor.tf.insertNodes(htmlToSlate(html)),
    insertText: (html, nextLine) => {
      if (nextLine) {
        editor.tf.collapse({ edge: "end" });
        editor.tf.insertBreak();
      }
      editor.tf.insertFragment(htmlToSlate(html));
    },
    getCurrentCursorPosition: () => {
      if (!editor.selection) return undefined;
      const id = ++sequence;
      bookmarks.set(id, editor.api.pointRef(editor.selection.focus));
      return id;
    },
    getCoordsFromPos: coords,
    setFocusAtPosition: (position) => {
      const at = point(position);
      if (!at) return;
      editor.tf.select(at);
      editor.tf.focus();
    },
    scrollToNodeViaDOMCoordinates: ({ pos, behavior }) => {
      const at = point(pos);
      if (!at) return;
      const entry = editor.api.node(at.path);
      if (entry) editor.api.toDOMNode(entry[0])?.scrollIntoView({ behavior, block: "nearest" });
    },
    createSelectionAtCursorPosition: () => {
      if (!editor.selection || editor.api.isExpanded()) return;
      const start = editor.api.before(editor.selection.focus, { unit: "word" });
      const end = editor.api.after(editor.selection.focus, { unit: "word" });
      if (start && end) editor.tf.select({ anchor: start, focus: end });
    },
    getAttributesWithExtendedMark: () => unsupported("getAttributesWithExtendedMark"),
    isAnyDropbarOpen: () => Boolean(document.querySelector('[data-plane-plate-menu="open"]')),
    isEditorReadyToDiscard: () => !assets.isUploading(),
    executeMenuItemCommand: (props) => {
      const key = props.itemKey as string;
      if (isPlateFeatureDisabled(disabled(), key)) throw new Error(`Editor feature ${key} is disabled`);
      if (["bold", "italic", "underline", "strikethrough", "code"].includes(key)) {
        editor.tf.toggleMark(key);
        return;
      }
      if (/^h[1-6]$/.test(key)) {
        editor.tf.setNodes({ type: key });
        return;
      }
      if (key === "image") {
        const image = props as { file?: File; pos?: number };
        const at = point(image.pos);
        if (at) editor.tf.select(at);
        if (image.file) void insertSandboxImage(editor, assets, image.file);
        else {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/*";
          const selection = editor.selection ? editor.api.rangeRef(editor.selection) : null;
          input.addEventListener(
            "change",
            () => {
              const target = selection?.unref();
              if (target) editor.tf.select(target);
              const file = input.files?.[0];
              if (file) void insertSandboxImage(editor, assets, file);
            },
            { once: true }
          );
          input.addEventListener("cancel", () => selection?.unref(), { once: true });
          input.click();
        }
        return;
      }
      if (key === "text-color" || key === "background-color") {
        const color = (props as { color?: string }).color;
        const mark = key === "text-color" ? "color" : "backgroundColor";
        if (color) editor.tf.addMark(mark, color);
        else editor.tf.removeMark(mark);
        return;
      }
      if (key === "text-align") {
        editor.tf.setNodes({ align: (props as { alignment: string }).alignment });
        return;
      }
      if (key === "link") {
        const link = props as { url: string; text?: string };
        editor.tf.insertNodes({ type: "a", url: link.url, children: [{ text: link.text ?? link.url }] });
        return;
      }
      if (key === "attachment") {
        const input = document.createElement("input");
        input.type = "file";
        input.addEventListener(
          "change",
          () => {
            const file = input.files?.[0];
            if (file)
              void assets.fileHandler.upload(crypto.randomUUID(), file).then((id) => {
                editor.tf.insertNodes({
                  type: "html_opaque",
                  html: `<file-component src="${id.replaceAll('"', "&quot;")}" name="${file.name.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;")}"></file-component>`,
                  children: [{ text: "" }],
                });
                return id;
              });
          },
          { once: true }
        );
        input.click();
        return;
      }
      if (key === "emoji") {
        document.dispatchEvent(new CustomEvent(`plate-command:${editor.id}`, { detail: "emoji" }));
        return;
      }
      const aliases: Record<string, string> = {
        text: "paragraph",
        quote: "blockquote",
        "bulleted-list": "bulletedList",
        "numbered-list": "numberedList",
        "to-do-list": "todoList",
        "ordered-list": "numberedList",
        "bullet-list": "bulletedList",
        "task-list": "todoList",
        "code-block": "codeBlock",
        divider: "horizontalRule",
        "horizontal-rule": "horizontalRule",
      };
      const command = aliases[key] ?? key;
      if (command in comparisonCommandLabels)
        executeComparisonCommand(editor, command as Parameters<typeof executeComparisonCommand>[1]);
      else unsupported(`command ${key}`);
    },
    isMenuItemActive: ({ itemKey }) =>
      Boolean(editor.api.marks()?.[itemKey as string] || editor.api.block()?.[0].type === itemKey),
    undo: () => editor.tf.undo(),
    redo: () => editor.tf.redo(),
    onStateChange: subscribe,
    onDocumentInfoChange: (callback) => subscribe(() => callback(info())),
    onHeadingChange: (callback) => subscribe(() => callback(headings())),
    scrollSummary: (marking) => {
      const node = editor.children[marking.sequence];
      if (node) editor.api.toDOMNode(node)?.scrollIntoView({ block: "start", behavior: "smooth" });
    },
    getCollaborationUsers: users,
    onCollaborationUsersChange: (callback) => {
      const awareness = provider()?.awareness;
      const listener = () => callback(users());
      awareness?.on("change", listener);
      return () => awareness?.off("change", listener);
    },
    setProviderDocument: (value) => {
      const current = provider();
      if (!current) throw new Error("No collaborative provider");
      Y.applyUpdate(current.document, value);
    },
    emitRealTimeUpdate: (message) => provider()?.sendStateless(message),
    listenToRealTimeUpdate: () => {
      const current = provider();
      return current ? { on: current.on.bind(current), off: current.off.bind(current) } : undefined;
    },
  };
  return {
    api,
    notify: () => stateListeners.forEach((fn) => fn()),
    dispose: () => {
      bookmarks.forEach((ref) => ref.unref());
      bookmarks.clear();
      stateListeners.clear();
    },
  };
}
