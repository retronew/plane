import { useState } from "react";
import { EXPORTERS_LIST } from "@plane/constants";
import { setToast } from "@plane/blocks/toast";
import { ChevronDown, Braces, FileSpreadsheet, Table2 } from "lucide-react";
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
  onExport: (format: AnalyticsExportFormat) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);
  const handleExport = async (format: AnalyticsExportFormat) => {
    if (exporting) return;
    setExporting(true);
    try {
      await onExport(format);
    } catch {
      setToast({
        type: "error",
        title: t("error"),
        message: t("workspace_settings.settings.exports.modal.toasts.error.message"),
      });
    } finally {
      setExporting(false);
    }
  };
  return (
    <Menu>
      <MenuTrigger
        disabled={disabled || exporting}
        render={
          <Button
            loading={exporting}
            variant="primary"
            size="md"
            stretch="auto"
            label={t("export")}
            icon={<Icon icon={ChevronDown} size="sm" />}
            iconPosition="end"
            disabled={disabled || exporting}
          />
        }
      />
      <ActionMenuContent side="bottom" align="end">
        <div className="min-w-28">
          {EXPORTERS_LIST.map(({ provider }) => {
            if (provider !== "csv" && provider !== "xlsx" && provider !== "json") return null;
            return (
              <MenuItem
                key={provider}
                label={provider === "xlsx" ? "Excel" : provider.toUpperCase()}
                icon={<Icon icon={provider === "json" ? Braces : provider === "xlsx" ? FileSpreadsheet : Table2} />}
                onClick={() => void handleExport(provider)}
              />
            );
          })}
        </div>
      </ActionMenuContent>
    </Menu>
  );
}
