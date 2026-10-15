import {
  Menu,
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSubmenu,
  MenuSubmenuContent,
  MenuSubmenuTrigger,
  MenuTrigger,
} from "@makeplane/propel/components/menu";
import { SortMenuItems } from "@/components/common/sort-menu";
import { Button } from "@makeplane/propel/components/button";
import { PROJECT_ORDER_BY_OPTIONS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { TProjectGrouping, TProjectLayout, TProjectOrderByOptions } from "@plane/types";
export function ProjectDisplayMenu({
  value = "created_at",
  onChange,
  layout = "gallery",
  groupBy = "status",
  onGroupChange,
}: {
  layout?: TProjectLayout;
  groupBy?: TProjectGrouping;
  onGroupChange?: (value: TProjectGrouping) => void;
  value?: TProjectOrderByOptions;
  onChange: (value: TProjectOrderByOptions) => void;
}) {
  const { t } = useTranslation();
  const descending = value.startsWith("-");
  const field = value.replace(/^-/, "");
  const options = PROJECT_ORDER_BY_OPTIONS;
  return (
    <Menu>
      <MenuTrigger render={<Button variant="secondary" size="md" stretch="auto" label={t("common.display")} />} />
      <MenuContent side="bottom" align="end">
        <div className="w-52 max-w-[calc(100vw-40px)]">
          {(layout === "board" || layout === "list") && (
            <MenuSubmenu>
              <MenuSubmenuTrigger
                label={t("web.project_page.group_by")}
                trailing={<span className="text-12 text-tertiary">{t(`web.project_page.groupings.${groupBy}`)}</span>}
              />
              <MenuSubmenuContent>
                <MenuRadioGroup
                  value={groupBy}
                  onValueChange={(grouping) => onGroupChange?.(grouping as TProjectGrouping)}
                >
                  {(["status", "state_group", "priority", "created_by", "labels"] as const).map((key) => (
                    <MenuRadioItem
                      key={key}
                      value={key}
                      label={t(`web.project_page.groupings.${key}`)}
                      closeOnClick={false}
                    />
                  ))}
                </MenuRadioGroup>
              </MenuSubmenuContent>
            </MenuSubmenu>
          )}
          <SortMenuItems
            field={field}
            direction={descending ? "desc" : "asc"}
            options={options.map((item) => ({ value: item.key, label: t(item.i18n_label) }))}
            onFieldChange={(next) =>
              onChange((next === "sort_order" ? next : `${descending ? "-" : ""}${next}`) as TProjectOrderByOptions)
            }
            directionDisabled={field === "sort_order"}
            onDirectionChange={(next) => onChange(`${next === "desc" ? "-" : ""}${field}` as TProjectOrderByOptions)}
          />
        </div>
      </MenuContent>
    </Menu>
  );
}
