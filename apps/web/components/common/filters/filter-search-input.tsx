import { SearchOutline, CloseOutline } from "@makeplane/propel/icons";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Focus the field when it opens; skipped on mobile so the keyboard does not pop up. */
  focusOnOpen?: boolean;
};

/** Search field at the top of a filter panel, with an inline clear button. */
export function FilterSearchInput({ value, onChange, placeholder, focusOnOpen = false }: Props) {
  const { isMobile } = usePlatformOS();

  return (
    <div className="flex items-center gap-1.5 rounded-sm border-[0.5px] border-subtle bg-surface-2 px-1.5 py-1 text-11">
      <SearchOutline className="text-placeholder" width={12} height={12} />
      <input
        type="text"
        className="w-full bg-surface-2 outline-none placeholder:text-placeholder"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- intentional focus on open
        autoFocus={focusOnOpen && !isMobile}
      />
      {value !== "" && (
        <button type="button" className="grid place-items-center" onClick={() => onChange("")}>
          <CloseOutline className="text-tertiary" height={12} width={12} />
        </button>
      )}
    </div>
  );
}
