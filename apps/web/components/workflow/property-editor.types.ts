export const PROPERTY_TYPES = ["text", "number", "dropdown", "boolean", "date", "member", "url"] as const;
export type PropertyDraft = {
  id?: string;
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
  }[];
};
