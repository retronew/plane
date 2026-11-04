import { IconButton } from "@makeplane/propel/components/icon-button";
import { useToggleButton, useToggleButtonState } from "@platejs/toggle/react";
import { ChevronRightIcon } from "lucide-react";
import { NodeApi } from "platejs";
import { PlateElement, type PlateElementProps } from "platejs/react";
import { useTranslation } from "@plane/i18n";

/** Body visibility, keyboard navigation and Enter behavior belong to TogglePlugin. */
export function ComparisonToggle(props: PlateElementProps) {
  const { t } = useTranslation();
  const { buttonProps, open } = useToggleButton(useToggleButtonState(String(props.element.id)));
  return (
    <PlateElement {...props} className="plane-toggle flex items-start gap-1" data-open={open}>
      <span contentEditable={false} className="inline-flex shrink-0">
        <IconButton
          {...buttonProps}
          type="button"
          size="sm"
          variant="ghost"
          aria-label={NodeApi.string(props.element) || t("title")}
          aria-expanded={open}
          icon={<ChevronRightIcon className={`size-4 transition-transform ${open ? "rotate-90" : ""}`} />}
        />
      </span>
      <span className="min-w-0 flex-1">{props.children}</span>
    </PlateElement>
  );
}
