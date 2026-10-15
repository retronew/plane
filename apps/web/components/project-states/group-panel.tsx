import type { ReactNode } from "react";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Plus } from "lucide-react";
import { useTranslation } from "@plane/i18n";

/** Shared state-group chrome; adapters own persistence and group semantics. */
export function StateGroupPanel({
  title,
  onAdd,
  addDisabled,
  children,
}: {
  title: string;
  onAdd: () => void;
  addDisabled?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section className="min-w-0">
      <div className="flex h-9 items-center gap-2 rounded-md bg-layer-1-hover px-2">
        <h4 className="min-w-0 flex-1 truncate px-2 text-13 font-medium text-secondary capitalize">{title}</h4>
        <IconButton
          type="button"
          variant="ghost"
          size="xs"
          aria-label={`${t("common.add")} ${title}`}
          disabled={addDisabled}
          onClick={onAdd}
          icon={<Plus className="size-3.5" />}
        />
      </div>
      <div>{children}</div>
    </section>
  );
}
