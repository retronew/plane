import { useEffect, useState, useRef, type RefObject } from "react";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { YjsEditor, slateRangeToRelativeRange, relativeRangeToSlateRange, type RelativeRange } from "@slate-yjs/core";
import { Avatar } from "@makeplane/propel/components/avatar";
import { useTranslation } from "@plane/i18n";
import type { PlateEditor } from "platejs/react";
import * as Y from "yjs";
import {
  bindComparisonEditor,
  comparisonRoomName,
  comparisonLiveUrl,
  type ComparisonRoom,
  type CollaborationStatus,
  type ComparisonIdentity,
} from "./collaboration";

type Cursor = { id: number; user: ComparisonIdentity; rects: DOMRect[]; caret: DOMRect; color: string };
const colors = ["#2563eb", "#9333ea", "#c2410c", "#047857"];
const bindings = new WeakMap<
  PlateEditor,
  { document: Y.Doc; editor: ReturnType<typeof bindComparisonEditor>; disposal?: ReturnType<typeof setTimeout> }
>();
function getBinding(editor: PlateEditor): NonNullable<ReturnType<typeof bindings.get>> {
  const existing = bindings.get(editor);
  if (existing) return existing;
  const document = new Y.Doc();
  const session = { document, editor: bindComparisonEditor(editor, document) };
  bindings.set(editor, session);
  return session;
}
export function useComparisonCollaboration(
  editor: PlateEditor,
  room: ComparisonRoom | undefined,
  container: RefObject<HTMLDivElement | null>
) {
  const [session] = useState(() => (room ? getBinding(editor) : null));
  const publishRef = useRef<() => void>(() => {});
  const [status, setStatus] = useState<CollaborationStatus>("connecting");
  const [cursors, setCursors] = useState<Cursor[]>([]);
  const [history, setHistory] = useState({ undo: false, redo: false });
  const providerRef = useRef<HocuspocusProvider | null>(null);
  useEffect(() => {
    if (!session || !room) return;
    clearTimeout(session.disposal);
    let disposed = false;
    let denied = false;
    let frame = 0;
    let synchronized = false;
    const updateHistory = () =>
      setHistory({ undo: session.editor.undoManager.canUndo(), redo: session.editor.undoManager.canRedo() });
    const clearPresence = () => {
      synchronized = false;
      setCursors([]);
    };
    const url = comparisonLiveUrl(room, window.location.origin);
    url.pathname += "/collaboration";
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("workspaceSlug", room.workspaceSlug);
    url.searchParams.set("projectId", room.projectId);
    const provider = new HocuspocusProvider({
      url: url.toString(),
      name: comparisonRoomName(room),
      document: session.document,
      token: JSON.stringify({ id: room.user.id }),
      onStatus: ({ status: next }) => {
        if (disposed) return;
        if (next === "connecting") denied = false;
        if (next !== "connected") {
          clearPresence();
          setStatus(denied ? "error" : next === "connecting" ? "connecting" : "disconnected");
        }
      },
      onAuthenticationFailed: () => {
        if (!disposed) {
          denied = true;
          clearPresence();
          setStatus("error");
        }
      },
      onSynced: ({ state }) => {
        if (!state || disposed) return;
        if (!YjsEditor.connected(session.editor)) YjsEditor.connect(session.editor);
        synchronized = true;
        provider.awareness?.setLocalStateField("user", room.user);
        setStatus("synced");
        updateHistory();
      },
      onClose: () => {
        if (!disposed) {
          clearPresence();
          setStatus(denied ? "error" : "disconnected");
        }
      },
    });
    providerRef.current = provider;
    const measure = () => {
      frame = 0;
      if (!synchronized || !container.current) return;
      const bounds = container.current.getBoundingClientRect();
      const next: Cursor[] = [];
      provider.awareness?.getStates().forEach((state, id) => {
        if (id === session.document.clientID || !state.selection || !state.user) return;
        try {
          const selection = relativeRangeToSlateRange(
            session.editor.sharedRoot,
            editor,
            state.selection as RelativeRange
          );
          if (!selection) return;
          const range = editor.api.toDOMRange(selection);
          const focus = editor.api.toDOMRange({ anchor: selection.focus, focus: selection.focus });
          if (!range || !focus) return;
          const offset = (rect: DOMRect) => new DOMRect(rect.x - bounds.x, rect.y - bounds.y, rect.width, rect.height);
          const caret = offset(focus.getBoundingClientRect());
          if (!caret.height) return;
          next.push({
            id,
            user: state.user as ComparisonIdentity,
            color: colors[id % colors.length],
            caret,
            rects: Array.from(range.getClientRects(), offset),
          });
        } catch {
          /* A remote range may briefly precede its content update. */
        }
      });
      setCursors(next);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const publish = () => {
      if (!synchronized) return;
      try {
        provider.awareness?.setLocalStateField(
          "selection",
          editor.selection ? slateRangeToRelativeRange(session.editor.sharedRoot, editor, editor.selection) : null
        );
      } catch {
        /* Wait for the next Slate flush. */
      }
      schedule();
    };
    const onBlur = () => provider.awareness?.setLocalStateField("selection", null);
    const onFocusOut = (event: FocusEvent) => {
      if (!container.current?.contains(event.relatedTarget as Node | null)) onBlur();
    };
    const element = container.current;
    element?.addEventListener("focusout", onFocusOut);
    // Re-entering an unchanged selection has no Slate operation to publish it again.
    element?.addEventListener("focusin", publish);
    publishRef.current = publish;
    provider.awareness?.on("change", schedule);
    session.document.on("update", schedule);
    session.editor.undoManager.on("stack-item-added", updateHistory);
    session.editor.undoManager.on("stack-item-popped", updateHistory);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    window.addEventListener("blur", onBlur);
    const resize = new ResizeObserver(schedule);
    if (container.current) resize.observe(container.current);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("blur", onBlur);
      element?.removeEventListener("focusout", onFocusOut);
      element?.removeEventListener("focusin", publish);
      publishRef.current = () => {};
      session.document.off("update", schedule);
      provider.awareness?.off("change", schedule);
      session.editor.undoManager.off("stack-item-added", updateHistory);
      session.editor.undoManager.off("stack-item-popped", updateHistory);
      provider.awareness?.setLocalState(null);
      if (YjsEditor.connected(session.editor)) YjsEditor.disconnect(session.editor);
      provider.destroy();
      providerRef.current = null;
      // StrictMode replays effects immediately; defer destruction so its second setup can reuse the binding.
      session.disposal = setTimeout(() => {
        session.editor.undoManager.destroy();
        session.document.destroy();
        bindings.delete(editor);
      }, 0);
    };
  }, [editor, session, room, container]);
  const onChange = () => {
    if (session && YjsEditor.connected(session.editor)) YjsEditor.flushLocalChanges(session.editor);
    publishRef.current();
  };
  return { session, status, cursors, history, onChange, retry: () => providerRef.current?.connect() };
}

export function RemoteComparisonCursors({ cursors }: { cursors: Cursor[] }) {
  const { t } = useTranslation();
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-visible"
      aria-label={t("editor_comparison.remoteCursors")}
    >
      {cursors.map(({ id, user, color, caret, rects }) => (
        <div key={id} data-remote-cursor={id}>
          {rects.map((rect) => (
            <span
              key={`${rect.x}:${rect.y}:${rect.width}:${rect.height}`}
              className="absolute"
              style={{
                left: rect.x,
                top: rect.y,
                width: rect.width,
                height: rect.height,
                backgroundColor: color,
                opacity: 0.18,
              }}
            />
          ))}
          <span
            className="absolute border-l-2"
            style={{ left: caret.x, top: caret.y, height: caret.height, borderColor: color }}
          >
            <span
              className="absolute bottom-full left-0 flex items-center gap-1 rounded px-1 py-0.5 text-11 whitespace-nowrap text-white"
              style={{ backgroundColor: color }}
            >
              <Avatar src={user.avatar} alt={user.name} fallback={user.name.charAt(0)} size="sm" />
              {user.name}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
