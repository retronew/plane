import { ChevronDown, FileJson, FileSpreadsheet } from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { Icon } from "@makeplane/propel/components/icon";
import { Menu, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { ActionMenuContent } from "@plane/blocks/common";
import { useTranslation } from "@plane/i18n";
import type { AnalyticsExportFormat } from "./export";

/** Shared by the overview, detail pages, and customized insight tables. */
export function AnalyticsExportMenu({
  disabled,
  onExport,
}: {
  disabled?: boolean;
  onExport: (format: AnalyticsExportFormat) => void;
}) {
  const { t } = useTranslation();
  return (
    <Menu>
      <MenuTrigger
        disabled={disabled}
        render={
          <Button
            variant="primary"
            size="md"
            stretch="auto"
            label={t("export")}
            icon={<Icon icon={ChevronDown} size="sm" />}
            iconPosition="end"
            disabled={disabled}
          />
        }
      />
      <ActionMenuContent side="bottom" align="end">
        <MenuItem label="CSV" icon={<Icon icon={FileSpreadsheet} />} onClick={() => onExport("csv")} />
        <MenuItem label="JSON" icon={<Icon icon={FileJson} />} onClick={() => onExport("json")} />
      </ActionMenuContent>
    </Menu>
  );
}
