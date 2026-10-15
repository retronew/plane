/** Fit category ticks to the 140px axis, accounting for wide Unicode glyphs. */
export function truncateCategoryLabel(value: string, maxUnits = 19): string {
  let units = 0;
  let result = "";
  for (const character of value) {
    const width = (character.codePointAt(0) ?? 0) > 255 ? 2 : 1;
    if (units + width > maxUnits) return `${result}…`;
    result += character;
    units += width;
  }
  return result;
}
