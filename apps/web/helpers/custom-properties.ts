import type {
  TCustomProperty,
  TCustomPropertyValue,
  TCustomPropertyValues,
} from "@/services/project/custom-properties.types";

export const activeCustomProperties = (properties: TCustomProperty[]) =>
  properties
    .filter((property) => property.is_active && (property.effective_is_active ?? true))
    // The TypeScript target lacks toSorted; filter creates an owned array before sorting.
    // oxlint-disable-next-line unicorn/no-array-sort
    .sort((a, b) => a.sort_order - b.sort_order);

export const isEmptyCustomPropertyValue = (value: TCustomPropertyValue | undefined) =>
  value === undefined ||
  value === null ||
  (typeof value === "string" && !value.trim()) ||
  (Array.isArray(value) && value.length === 0);

export function customPropertyDefaults(properties: TCustomProperty[]): TCustomPropertyValues {
  return Object.fromEntries(
    properties
      .filter((property) => property.config.default_value !== undefined)
      .map((property) => [property.id, property.config.default_value ?? null])
  );
}

export function customPropertyPayload(
  properties: TCustomProperty[],
  values: TCustomPropertyValues
): TCustomPropertyValues {
  return Object.fromEntries(
    properties
      .filter((property) => !property.config.read_only && values[property.id] !== undefined)
      .map((property) => [property.id, values[property.id]])
  );
}

export function customPropertyErrors(
  properties: TCustomProperty[],
  values: TCustomPropertyValues
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const property of properties) {
    const value = values[property.id];
    if (
      (property.effective_is_required ?? property.is_required) &&
      !property.config.read_only &&
      isEmptyCustomPropertyValue(value)
    ) {
      errors[property.id] = "required";
    } else if (!isEmptyCustomPropertyValue(value)) {
      if (property.property_type === "number" && (typeof value !== "number" || !Number.isFinite(value)))
        errors[property.id] = "invalid_number";
      if (property.property_type === "url" && typeof value === "string") {
        try {
          const url = new URL(value);
          if (!["https:", "http:"].includes(url.protocol)) errors[property.id] = "invalid_url";
        } catch {
          errors[property.id] = "invalid_url";
        }
      }
    }
  }
  return errors;
}
