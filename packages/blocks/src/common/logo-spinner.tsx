type Props = {
  /** Light-theme logo asset, rendered until the theme flips. */
  lightSrc: string;
  /** Dark-theme logo asset. */
  darkSrc: string;
};

/**
 * Branded loading indicator: both variants render and the `dark:` class picks one off the `data-theme`
 * attribute, which the theme script sets before hydration. Callers own the assets so each app can keep
 * using its own build-time `?url` imports.
 */
export function LogoSpinner({ lightSrc, darkSrc }: Props) {
  return (
    <div className="flex items-center justify-center">
      <img src={lightSrc} alt="logo" className="h-6 w-auto object-contain sm:h-11 dark:hidden" />
      <img src={darkSrc} alt="logo" className="hidden h-6 w-auto object-contain sm:h-11 dark:block" />
    </div>
  );
}
