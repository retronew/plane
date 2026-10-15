import { Menu, MenuContent, MenuTrigger } from "@makeplane/propel/components/menu";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { Settings2 } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import type { IIssueDisplayProperties } from "@plane/types";
import { DisplayFiltersSelection } from "../filters/header/display-filters/display-filters-selection";

type Props = {
  displayProperties: IIssueDisplayProperties;
  properties: (keyof IIssueDisplayProperties)[];
  onChange: (data: Partial<IIssueDisplayProperties>) => void;
  isEpic?: boolean;
};

export function SpreadsheetPropertiesMenu({ displayProperties, properties, onChange, isEpic }: Props) {
  const { t } = useTranslation();
  const label = t("issue.display.properties.label");
  return (
    <Menu>
      <Tooltip label={label}>
        <MenuTrigger
          render={
            <button
              type="button"
              aria-label={label}
              className="grid size-7 place-items-center rounded-sm text-secondary hover:bg-layer-transparent-hover focus-visible:outline-2 focus-visible:outline-accent-strong"
            />
          }
        >
          <Settings2 className="size-4" />
        </MenuTrigger>
      </Tooltip>
      <MenuContent align="end" side="bottom">
        <DisplayFiltersSelection
          displayProperties={displayProperties}
          displayFilters={undefined}
          handleDisplayPropertiesUpdate={onChange}
          handleDisplayFiltersUpdate={() => {}}
          layoutDisplayFiltersOptions={{
            display_properties: properties,
            display_filters: {},
            extra_options: { access: false, values: [] },
          }}
          isEpic={isEpic}
        />
      </MenuContent>
    </Menu>
  );
}
