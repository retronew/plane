export const PROPERTY_TYPES = ["text", "number", "dropdown", "boolean", "date", "member", "url"] as const;
export type PropertyDraft = {
  id?: string;
  options_version?: string;
  name: string;
  description: string;
  property_type: (typeof PROPERTY_TYPES)[number];
  config: Record<string, unknown>;
  is_active: boolean;
  is_required: boolean;
  options?: {
    id?: string;
    name: string;
    color?: string;
    sort_order?: number;
    client_id?: string;
    is_active?: boolean;
    is_archived?: boolean;
  }[];
};
export type PropertyErrors = Partial<
  Record<"name" | "description" | "property_type" | "config" | "options" | "form", string>
>;
export const optionKey = (option: NonNullable<PropertyDraft["options"]>[number]) => option.id ?? option.client_id ?? "";
export function optionError(options: PropertyDraft["options"], index: number) {
  const name = options?.[index].name.trim() ?? "";
  if (!name) return "option_required";
  if (
    options?.some(
      (option, position) => position !== index && option.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase()
    )
  )
    return "option_duplicate";
  return undefined;
}
