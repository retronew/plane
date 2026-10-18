import type { ReactNode } from "react";
import { TickOutline } from "@makeplane/propel/icons";

type Props = {
  icon?: ReactNode;
  isChecked: boolean;
  title: ReactNode;
  onClick?: () => void;
  multiple?: boolean;
  activePulse?: boolean;
};

/** Checkbox/radio row of a filter panel, shared by the web and space filter dropdowns. */
export function FilterOption(props: Props) {
  const { icon, isChecked, multiple = true, onClick, title, activePulse = false } = props;

  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-sm p-1.5 hover:bg-layer-transparent-hover"
      onClick={onClick}
    >
      <div
        className={`grid h-3 w-3 flex-shrink-0 place-items-center border ${
          isChecked ? "border-accent-strong bg-accent-primary text-on-color" : "border-strong"
        } ${multiple ? "rounded-xs" : "rounded-full"}`}
      >
        {isChecked && <TickOutline width={10} height={10} />}
      </div>
      <div className="flex items-center gap-2 truncate">
        {icon && <div className="grid w-5 flex-shrink-0 place-items-center">{icon}</div>}
        <div className="flex-grow truncate text-caption-sm-regular text-secondary">{title}</div>
      </div>
      {activePulse && (
        <div className="ml-auto h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-accent-primary text-caption-sm-regular" />
      )}
    </button>
  );
}
