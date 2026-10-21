import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@makeplane/propel/elements/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import { cn } from "@plane/utils";

// Unlike the legacy clipboard helper, a rejected fallback must not report success.
async function writeClipboard(value: string) {
  if (navigator.clipboard) return navigator.clipboard.writeText(value);
  const previousFocus = document.activeElement;
  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  try {
    input.select();
    if (!document.execCommand("copy")) throw new Error("Clipboard copy failed");
  } finally {
    input.remove();
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
  }
}

export function useCopyFeedback() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current += 1;
      clearTimeout(timer.current);
    },
    []
  );

  const copy = async (value: string) => {
    const currentRequest = ++request.current;
    clearTimeout(timer.current);
    setCopied(false);
    try {
      await writeClipboard(value);
      if (currentRequest !== request.current) return;
      setCopied(true);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      if (currentRequest !== request.current) return;
      setToast({ type: "error", title: t("error"), message: t("account_settings.mcp.copy_failed") });
    }
  };
  return { copied, copy };
}

export function CopyFeedback({ copied, label }: { copied: boolean; label?: string }) {
  const { t } = useTranslation();
  const copiedLabel = t("common.copied");
  const layer =
    "[grid-area:1/1] transition-opacity duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-safe:transition-[opacity,filter,scale]";
  const iconLayer = (visible: boolean) =>
    cn(
      layer,
      visible
        ? "opacity-100 motion-safe:scale-100 motion-safe:blur-[0px]"
        : "opacity-0 motion-safe:scale-[0.25] motion-safe:blur-[4px]"
    );
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      <span aria-hidden="true" className="grid size-4 place-items-center">
        <Copy className={cn("size-4", iconLayer(!copied))} />
        <Check className={cn("size-4", iconLayer(copied))} />
      </span>
      {label && <span>{label}</span>}
      <output className="sr-only" aria-live="polite" aria-atomic="true">
        {copied ? copiedLabel : ""}
      </output>
    </span>
  );
}

export function ApiTokenCopyButton({
  value,
  label,
  iconOnly = false,
  ariaLabel,
}: {
  value: string;
  label: string;
  iconOnly?: boolean;
  ariaLabel?: string;
}) {
  const { copied, copy } = useCopyFeedback();
  if (iconOnly)
    return (
      <IconButton
        variant="ghost"
        size="sm"
        aria-label={ariaLabel ?? label}
        onClick={() => void copy(value)}
        icon={<CopyFeedback copied={copied} />}
      />
    );
  return (
    <Button
      variant="secondary"
      size="sm"
      stretch="auto"
      type="button"
      aria-label={ariaLabel ?? label}
      onClick={() => void copy(value)}
    >
      <CopyFeedback copied={copied} label={label} />
    </Button>
  );
}
