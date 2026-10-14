/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type React from "react";
import { useEffect, useEffectEvent, useState, useRef } from "react";
import { Controller, useForm } from "react-hook-form"; // services
import { WarningCircleOutline } from "@makeplane/propel/icons";
// plane imports
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { Popover, PopoverBody, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";
import type { EditorRefApi } from "@plane/editor";
import { Button } from "@makeplane/propel/components/button";
import { setToast } from "@plane/blocks/toast";
import { toSideAndAlign } from "@plane/blocks/common";
import type { TPopoverMenuPlacement } from "@plane/blocks/common";
import { cn } from "@plane/utils";

// components
import { RichTextEditor } from "@/components/editor/rich-text";
// services
import { AIService } from "@/services/ai.service";
import { translate } from "@plane/i18n";
const aiService = new AIService();

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The editor takes HTML: escape the model's plain text and keep its paragraphs and line breaks. */
const textToHtml = (text: string) =>
  text
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br/>")}</p>`)
    .join("");

const handleInvalidTask = () => {
  setToast({
    type: "error",
    title: translate("toast.error"),
    message: translate("web.please_enter_some_task_to_get_ai_assistance"),
  });
};

type Props = {
  isOpen: boolean;
  handleClose: () => void;
  onResponse: (response: any) => void;
  onError?: (error: any) => void;
  placement?: TPopoverMenuPlacement;
  prompt?: string;
  button: React.ReactNode;
  className?: string;
  workspaceId: string;
  workspaceSlug: string;
  projectId: string;
};

type FormData = {
  prompt: string;
  task: string;
};

export function GptAssistantPopover(props: Props) {
  const {
    isOpen,
    handleClose,
    onResponse,
    onError,
    placement,
    prompt,
    button,
    className = "",
    workspaceId,
    workspaceSlug,
    projectId,
  } = props;
  // states
  const [response, setResponse] = useState("");
  const [invalidResponse, setInvalidResponse] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  // refs
  const editorRef = useRef<EditorRefApi>(null);
  const abortRef = useRef<AbortController | null>(null);
  // derived values
  const { side, align } = toSideAndAlign(placement ?? "auto");
  // form
  const { handleSubmit, control, reset, setFocus } = useForm<FormData>({
    defaultValues: {
      prompt: prompt || "",
      task: "",
    },
  });

  const onClose = () => {
    abortRef.current?.abort();
    handleClose();
    setResponse("");
    setInvalidResponse(false);
    reset();
  };

  const handleServiceError = (err: any) => {
    const error = err?.data?.error;
    const errorMessage =
      err?.status === 429
        ? error || translate("web.you_have_reached_the_maximum_number_of_requests_of_50_reques")
        : error || translate("web.some_error_occurred_please_try_again");

    setToast({
      type: "error",
      title: translate("toast.error"),
      message: errorMessage,
    });

    if (onError) onError(err);
  };

  const callAIService = async (formData: FormData) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setResponse("");
    setInvalidResponse(false);
    setIsStreaming(true);
    try {
      const text = await aiService.streamGptTask(
        workspaceSlug.toString(),
        { prompt: prompt || "", task: formData.task },
        (delta) => setResponse((prev) => prev + delta),
        controller.signal
      );
      setFocus("task");
      setInvalidResponse(text.trim() === "");
    } catch (err) {
      if (controller.signal.aborted) return;
      handleServiceError(err);
    } finally {
      if (abortRef.current === controller) setIsStreaming(false);
    }
  };

  const handleAIResponse = async (formData: FormData) => {
    if (!workspaceSlug) return;

    if (formData.task === "") {
      handleInvalidTask();
      return;
    }

    await callAIService(formData);
  };

  useEffect(() => {
    if (isOpen) setFocus("task");
  }, [isOpen, setFocus]);

  useEffect(() => {
    editorRef.current?.setEditorValue(prompt || "");
  }, [editorRef, prompt]);

  // Read the latest submit handler (it closes over `prompt` and the workspace props) without
  // re-subscribing the Enter listener on every render.
  const onEnterKey = useEffectEvent(() => void handleSubmit(handleAIResponse)());

  useEffect(() => {
    const handleEnterKeyPress = (event: KeyboardEvent) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        onEnterKey();
      }
    };

    // Escape is Base UI's now: it closes the popover, which runs `onClose` through `onOpenChange`.
    if (isOpen) window.addEventListener("keydown", handleEnterKeyPress);

    return () => {
      window.removeEventListener("keydown", handleEnterKeyPress);
    };
  }, [isOpen]);

  const responseActionButton = response !== "" && !isStreaming && (
    <Button
      variant="primary"
      size="sm"
      stretch="auto"
      label={translate("web.use_this_response")}
      onClick={() => {
        onResponse(textToHtml(response));
        onClose();
      }}
    />
  );

  const generateResponseButtonText = isStreaming
    ? translate("web.generating_response")
    : response === ""
      ? translate("web.generate_response")
      : translate("web.generate_again");

  return (
    <div className="relative w-min text-left">
      <Popover
        open={isOpen}
        onOpenChange={(nextOpen) => {
          // The caller's own button owns opening (`openOnClick={false}` below), so the only
          // transitions Base UI drives here are dismissals: Escape and outside press.
          if (!nextOpen) onClose();
        }}
      >
        {/* The trigger only anchors the panel: the `button` node the caller hands us already toggles
            `isOpen`, so a second toggle here would cancel it out. It stays out of the tab order,
            as the `<button tabIndex={-1}>` it replaces did. */}
        <PopoverTrigger
          nativeButton={false}
          openOnClick={false}
          tabIndex={-1}
          render={<span className="flex items-center" />}
        >
          {button}
        </PopoverTrigger>
        {/* The popover owns the portal, positioning, enter/leave and the panel surface, so
            the old popper positioning, enter/leave transition and hand-rolled chrome all go. */}
        <PopoverContent variant="rich" side={side} align={align}>
          <div className={cn("flex min-h-0 w-200 max-w-full flex-1 flex-col space-y-4 overflow-hidden", className)}>
            <PopoverBody tabIndex={0}>
              <div className="vertical-scroll-enable max-h-72 space-y-4 overflow-y-auto">
                {prompt && (
                  <div className="text-13">
                    {translate("web.content")}
                    <RichTextEditor
                      editable={false}
                      id="ai-assistant-content"
                      initialValue={prompt}
                      containerClassName="-m-3"
                      ref={editorRef}
                      workspaceId={workspaceId}
                      workspaceSlug={workspaceSlug}
                      projectId={projectId}
                    />
                  </div>
                )}
                {response !== "" && (
                  <div className="text-13">
                    {translate("web.response")}
                    <div className="mt-2 text-14 break-words whitespace-pre-wrap text-primary" aria-live="polite">
                      {response}
                    </div>
                  </div>
                )}
                {invalidResponse && (
                  <div className="text-13 text-danger-primary">{translate("web.ai_no_response")}</div>
                )}
              </div>
            </PopoverBody>
            <Controller
              control={control}
              name="task"
              render={({ field: { value, onChange, ref } }) => (
                <InputGroup size="lg">
                  <Input
                    size="lg"
                    id="task"
                    name="task"
                    type="text"
                    value={value}
                    onChange={onChange}
                    ref={ref}
                    placeholder={`${
                      prompt && prompt !== ""
                        ? "Tell AI what action to perform on this content..."
                        : "Ask AI anything..."
                    }`}
                    // oxlint-disable-next-line jsx-a11y/no-autofocus -- intentional focus on open
                    autoFocus
                  />
                </InputGroup>
              )}
            />
            <div className="flex justify-between gap-2">
              {responseActionButton ? (
                <>{responseActionButton}</>
              ) : (
                <>
                  <div className="flex items-start justify-center gap-2 text-13 text-accent-primary">
                    <WarningCircleOutline className="h-4 w-4" />
                    <p>{translate("web.by_using_this_feature_you_consent_to_sharing_the_message_wit")} </p>
                  </div>
                </>
              )}
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" stretch="auto" label={translate("web.close")} onClick={onClose} />
                <Button
                  variant="primary"
                  size="sm"
                  stretch="auto"
                  label={generateResponseButtonText}
                  onClick={() => void handleSubmit(handleAIResponse)()}
                  loading={isStreaming}
                />
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
