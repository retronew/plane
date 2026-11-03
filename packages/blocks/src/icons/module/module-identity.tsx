import { cn } from "@plane/utils";

const palettes = ["indigo", "emerald", "crimson", "yellow", "orange", "pink", "purple"] as const;

/** A module keeps its identity colour when renamed, reordered or shown in another picker. */
export function ModuleIdentity({ id, name, className }: { id: string; name: string; className?: string }) {
  const hash = Array.from(id).reduce((value, character) => (Math.imul(value, 31) + character.codePointAt(0)!) | 0, 0);
  const palette = palettes[(hash >>> 0) % palettes.length];
  const initials = Array.from(name.trim()).slice(0, 2).join("").toLocaleUpperCase();
  return (
    <span
      aria-hidden="true"
      data-module-identity={id}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-[9px] leading-none font-semibold",
        className
      )}
      style={{ backgroundColor: `var(--label-${palette}-bg)`, color: `var(--label-${palette}-text)` }}
    >
      {initials || "M"}
    </span>
  );
}
