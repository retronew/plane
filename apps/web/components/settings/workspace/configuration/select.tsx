import { Select, SelectContent, SelectList, SelectItem, SelectTrigger } from "@makeplane/propel/components/select";
export function ConfigurationSelect({
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <div className="min-w-0 [&_button]:w-full [&_button]:min-w-0">
      <Select<string>
        items={options}
        value={value}
        onValueChange={(next) => {
          if (typeof next === "string") onChange(next);
        }}
        disabled={disabled}
      >
        <SelectTrigger size="md" placeholder={placeholder} />
        <SelectContent>
          <SelectList>
            {options.map((option) => (
              <SelectItem key={option.value} {...option} size="md" />
            ))}
          </SelectList>
        </SelectContent>
      </Select>
    </div>
  );
}
