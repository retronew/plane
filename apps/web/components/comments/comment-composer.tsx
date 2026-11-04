import { useEffect, useRef, type ReactNode, type FocusEventHandler } from "react";
import { cn } from "@plane/utils";
// oxlint-disable-next-line import/no-unassigned-import -- Shared comment input typography.
import "./comment-composer.css";

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  compact?: boolean;
  disabled?: boolean;
  className?: string;
  onFocusInput: () => void;
  onFocus?: FocusEventHandler<HTMLDivElement>;
  onBlur?: FocusEventHandler<HTMLDivElement>;
};

/** Shared input surface for rich-text work item comments and plain-text project discussions. */
export function CommentComposer({
  children,
  footer,
  compact = true,
  disabled = false,
  className,
  onFocusInput,
  onFocus,
  onBlur,
}: Props) {
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = surface.current;
    if (!element || disabled) return;
    const focus = (event: MouseEvent) => {
      if (event.button !== 0 || !(event.target instanceof Element)) return;
      const control = event.target.closest(
        'button, a, input, textarea, select, [contenteditable="true"], [role="button"], [role="menu"], [role="menuitem"], [role="combobox"], dialog, [role="dialog"]'
      );
      if (control && element.contains(control)) return;
      event.preventDefault();
      onFocusInput();
    };
    element.addEventListener("mousedown", focus);
    return () => element.removeEventListener("mousedown", focus);
  }, [disabled, onFocusInput]);

  return (
    <div
      ref={surface}
      data-comment-composer=""
      data-comment-editor={disabled ? undefined : ""}
      className={cn(
        "relative border",
        compact
          ? "overflow-hidden rounded-xl border-subtle-1 bg-layer-2 transition-[background-color,border-color,box-shadow] focus-within:border-accent-strong focus-within:bg-layer-2-hover focus-within:ring-2 focus-within:ring-accent-strong/20 hover:border-strong hover:bg-layer-2-hover focus-within:hover:border-accent-strong"
          : "rounded-sm border-subtle",
        className
      )}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {compact ? (
        <div data-comment-composer-body="" className="min-h-16 p-3">
          {children}
        </div>
      ) : (
        children
      )}
      {footer && <div data-comment-composer-footer="">{footer}</div>}
    </div>
  );
}
