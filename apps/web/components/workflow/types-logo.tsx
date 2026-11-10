import { EpicOutline } from "@makeplane/propel/icons";
import { Logo, LUCIDE_ICONS_LIST, MATERIAL_ICONS_LIST } from "@plane/blocks/emoji-icon-picker";
import type { TLogoProps, TProjectIssueType } from "@plane/types";
import { generateIconColors } from "@plane/utils";
import { WorkItemTypeGlyph } from "@/components/issues/work-item-type-glyph";

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
  type: Pick<TProjectIssueType, "logo_props" | "level">;
  size?: number;
  backgroundSize?: number;
}) {
  const logo = type.logo_props as TLogoProps | undefined;
  const renderer = getIconRenderer(logo);
  const Icon = (type.level ?? 0) > 0 ? EpicOutline : WorkItemTypeGlyph;
  const hasEmoji = logo?.in_use === "emoji" && !!logo.emoji?.value;
  // SaaS type icons use background_color as their source color, then derive a 25% tint.
  // Keep compatibility with project icons saved with only the legacy foreground color.
  const sourceColor = logo?.icon?.background_color;
  const colors = generateIconColors(
    sourceColor && /^#[\da-f]{6}$/i.test(sourceColor) ? sourceColor : (logo?.icon?.color ?? "#000000")
  );
  const renderedLogo: TLogoProps | undefined = logo
    ? { ...logo, icon: { ...logo.icon, color: colors.foreground } }
    : undefined;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-sm [&_.material-symbols-rounded]:scale-100!"
      data-type-logo=""
      style={{
        color: colors.foreground,
        backgroundColor: hasEmoji ? undefined : sourceColor === "transparent" ? "transparent" : colors.background,
        width: backgroundSize ?? size,
        height: backgroundSize ?? size,
      }}
    >
      {renderer || hasEmoji ? (
        <Logo logo={renderedLogo} size={size} type={renderer} background={false} />
      ) : (
        <Icon className="shrink-0" style={{ width: size, height: size }} />
      )}
    </span>
  );
}
