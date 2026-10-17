import { useState } from "react";
import { PagesOutline } from "@makeplane/propel/icons";
import { EmojiPicker, Logo } from "@plane/blocks/emoji-icon-picker";
import { useTranslation } from "@plane/i18n";
import type { TLogoProps } from "@plane/types";
import { TemplateDescription } from "./work-item-fields";

export function TemplatePageFields({
  title,
  description,
  logo,
  onChange,
  workspaceSlug,
  projectId,
  disabled,
}: {
  title: string;
  description: string;
  logo?: TLogoProps;
  onChange: (patch: { title?: string; description_html?: string; logo_props?: TLogoProps }) => void;
  workspaceSlug: string;
  projectId: string;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <section className="flex flex-col gap-5">
      <h3 className="text-16 font-medium">{t("web.project_template_add_content")}</h3>
      <div className="flex flex-col gap-4">
        <EmojiPicker
          isOpen={pickerOpen}
          handleToggle={setPickerOpen}
          disabled={disabled}
          buttonClassName="grid size-12 place-items-center rounded-md hover:bg-layer-2-hover"
          label={
            logo?.in_use ? (
              <Logo logo={logo} size={36} type="lucide" />
            ) : (
              <PagesOutline className="size-9 text-tertiary" />
            )
          }
          onChange={(selection: { type: "emoji" | "icon"; value: string | TLogoProps["icon"] }) => {
            if (selection.type === "emoji" && typeof selection.value === "string") {
              onChange({ logo_props: { in_use: "emoji", emoji: { value: selection.value } } });
            } else if (selection.type === "icon" && typeof selection.value === "object") {
              onChange({ logo_props: { in_use: "icon", icon: selection.value } });
            }
            setPickerOpen(false);
          }}
          defaultIconColor={logo?.icon?.color}
          defaultOpen={logo?.in_use === "emoji" ? "emoji" : "icon"}
        />
        <input
          name="template.title"
          aria-label={t("web.template_title")}
          placeholder={t("web.untitled_page")}
          maxLength={255}
          disabled={disabled}
          value={title}
          onChange={(event) => onChange({ title: event.target.value })}
          className="w-full rounded-sm bg-transparent py-1 text-16 font-medium outline-none placeholder:text-placeholder focus-visible:ring-2 focus-visible:ring-accent-strong"
        />
        <TemplateDescription
          id="project-template-page"
          value={description}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          disabled={disabled}
          onChange={(description_html) => onChange({ description_html })}
        />
      </div>
    </section>
  );
}
