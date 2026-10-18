import { EpicOutline, WorkItemsOutline } from "@makeplane/propel/icons";
import { Logo, LUCIDE_ICONS_LIST, MATERIAL_ICONS_LIST, getIconBackgroundStyle } from "@plane/blocks/emoji-icon-picker";
import type { TLogoProps, TProjectIssueType } from "@plane/types";

function getIconRenderer(logo: TLogoProps | undefined) {
  if (logo?.in_use !== "icon" || !logo.icon?.name) return undefined;
  const name = logo.icon.name;
  if (LUCIDE_ICONS_LIST.some((icon) => icon.name === name)) return "lucide";
  if (MATERIAL_ICONS_LIST.some((icon) => icon.name === name)) return "material";
  return undefined;
}

export function TypesLogo({
  type,
  size = 20,
  backgroundSize,
}: {
  type: Pick<TProjectIssueType, "logo_props" | "is_epic" | "level">;
  size?: number;
  backgroundSize?: number;
}) {
  const logo = type.logo_props as TLogoProps | undefined;
  if (logo?.in_use === "emoji" && logo.emoji?.value) return <Logo logo={logo} size={size} />;
  const renderer = getIconRenderer(logo);
  if (renderer) {
    if (backgroundSize) {
      return (
        <span
          className="inline-flex shrink-0 items-center justify-center rounded-sm [&_.material-symbols-rounded]:scale-100!"
          style={{ ...getIconBackgroundStyle(logo), width: backgroundSize, height: backgroundSize }}
        >
          <Logo logo={logo} size={size} type={renderer} background={false} />
        </span>
      );
    }
    return <Logo logo={logo} size={size} type={renderer} />;
  }
  const Icon = type.is_epic || (type.level ?? 0) > 0 ? EpicOutline : WorkItemsOutline;
  return <Icon className="shrink-0 text-secondary" style={{ width: size, height: size }} />;
}
