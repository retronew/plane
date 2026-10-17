import { EpicOutline, WorkItemsOutline } from "@makeplane/propel/icons";
import { Logo } from "@plane/blocks/emoji-icon-picker";
import type { TLogoProps, TProjectIssueType } from "@plane/types";

export function TypesLogo({ type }: { type: Pick<TProjectIssueType, "logo_props" | "is_epic" | "level"> }) {
  const logo = type.logo_props as TLogoProps | undefined;
  const hasValue = logo?.in_use === "emoji" ? !!logo.emoji?.value : logo?.in_use === "icon" && !!logo.icon?.name;
  if (hasValue) return <Logo logo={logo} size={20} />;
  const Icon = type.is_epic || (type.level ?? 0) > 0 ? EpicOutline : WorkItemsOutline;
  return <Icon className="size-5 shrink-0 text-secondary" />;
}
