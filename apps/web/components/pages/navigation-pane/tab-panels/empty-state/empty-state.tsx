import { useTheme } from "next-themes";

type Props = {
  lightImage: string;
  darkImage: string;
  imageAlt: string;
  title: string;
  description: string;
};

/** Illustration + copy placeholder shared by the navigation pane's tab empty states. */
export function PageNavigationPaneEmptyState({ lightImage, darkImage, imageAlt, title, description }: Props) {
  const { resolvedTheme } = useTheme();
  const resolvedPath = resolvedTheme === "light" ? lightImage : darkImage;

  return (
    <div className="grid size-full place-items-center">
      <div className="flex flex-col items-center gap-y-6 text-center">
        <img src={resolvedPath} className="size-40 object-contain" alt={imageAlt} />
        <div className="space-y-2.5">
          <h4 className="text-14 font-medium">{title}</h4>
          <p className="text-13 font-medium text-secondary">{description}</p>
        </div>
      </div>
    </div>
  );
}
