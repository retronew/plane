/** Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only */

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useTranslation } from "@plane/i18n";
import { AIService } from "@/services/ai.service";
import { textToHtml } from "./writing";
import type { WritingContext, WritingMode } from "./writing";

const service = new AIService();
type Props = {
  workspaceSlug: string;
  getContext: () => WritingContext;
  onApply: (html: string, mode: WritingMode, context: WritingContext) => boolean;
  onClose: () => void;
  onUndo: (context: WritingContext) => void;
};

/** Opening the preview starts optimization; the backend owns all instructions. */
export function WritingAssistant({ workspaceSlug, getContext, onApply, onClose, onUndo }: Props) {
  const { t } = useTranslation();
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const snapshot = useRef<WritingContext | null>(null);
  const appliedDocument = useRef<string | null>(null);

  const generate = async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const context = getContext();
    snapshot.current = context;
    setResponse("");
    setError("");
    setComplete(false);
    setApplied(false);
    setBusy(true);
    try {
      const result = await service.streamGptTask(
        workspaceSlug,
        { context },
        (delta) => {
          if (controller.current === current) setResponse((value) => value + delta);
        },
        current.signal
      );
      if (controller.current !== current) return;
      setComplete(Boolean(result.trim()));
      if (!result.trim()) setError(t("web.ai_no_response"));
    } catch (failure) {
      if (controller.current === current && !current.signal.aborted) {
        const status = failure && typeof failure === "object" && "status" in failure ? failure.status : undefined;
        setError(
          t(
            status === 429
              ? "web.ai_writing_quota"
              : status === 400
                ? "web.ai_writing_invalid"
                : "web.ai_writing_failed"
          )
        );
      }
    } finally {
      if (controller.current === current) {
        controller.current = null;
        setBusy(false);
      }
    }
  };
  const startOnOpen = useEffectEvent(() => {
    void generate();
  });
  useEffect(() => {
    // Defer one tick so Strict Mode's discarded mount cannot issue a duplicate paid request.
    const timer = setTimeout(startOnOpen, 0);
    return () => {
      clearTimeout(timer);
      controller.current?.abort();
      controller.current = null;
    };
  }, []);
  const stop = () => {
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setComplete(false);
    setError(t("web.ai_writing_stopped"));
  };
  const apply = (mode: WritingMode) => {
    if (!snapshot.current || !complete || busy || applied) return;
    if (!onApply(textToHtml(response), mode, snapshot.current)) {
      setError(t("web.ai_writing_changed"));
      setComplete(false);
      return;
    }
    appliedDocument.current = getContext().document;
    setApplied(true);
  };
  const buttonClass = "rounded-sm border border-subtle px-3 py-1.5 text-13 disabled:opacity-50";
  return (
    <div className="flex w-[min(520px,90vw)] flex-col gap-3 p-3" aria-label={t("web.ai_writing_title")}>
      <div className="flex items-center justify-between gap-2">
        <strong>{t("web.ai_writing_title")}</strong>
        <button type="button" className={buttonClass} onClick={onClose}>
          {t("web.close")}
        </button>
      </div>
      <p className="text-13 text-secondary">{t(busy ? "web.ai_writing_optimizing" : "web.ai_writing_context")}</p>
      {response && (
        <div className="max-h-72 overflow-auto text-13 whitespace-pre-wrap" aria-live="polite">
          {response}
        </div>
      )}
      {error && (
        <p role="alert" className="text-13 text-danger-primary">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {busy && (
          <button type="button" className={buttonClass} onClick={stop}>
            {t("web.ai_writing_stop")}
          </button>
        )}
        {!busy && !applied && (
          <button type="button" className={buttonClass} onClick={() => void generate()}>
            {t("web.ai_writing_retry")}
          </button>
        )}
        {complete && !applied && (
          <>
            <button type="button" className={buttonClass} onClick={() => apply("replace")}>
              {t("web.ai_writing_replace")}
            </button>
            <button type="button" className={buttonClass} onClick={() => apply("append")}>
              {t("web.ai_writing_append")}
            </button>
          </>
        )}
        {applied && (
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              if (getContext().document !== appliedDocument.current) {
                setError(t("web.ai_writing_changed"));
                return;
              }
              if (snapshot.current) onUndo(snapshot.current);
              setApplied(false);
              setComplete(false);
            }}
          >
            {t("web.ai_writing_undo")}
          </button>
        )}
      </div>
    </div>
  );
}
