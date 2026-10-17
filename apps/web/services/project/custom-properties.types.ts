export type TCustomPropertyType = "text" | "number" | "dropdown" | "boolean" | "date" | "url" | "member";
export type TCustomPropertyValue = string | number | boolean | string[] | null;
export type TCustomPropertyValues = Record<string, TCustomPropertyValue>;

export type TCustomPropertyOption = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_active: boolean;
};

export type TCustomProperty = {
  id: string;
  name: string;
  description: string;
  property_type: TCustomPropertyType;
  config: {
    multiline?: boolean;
    multiple?: boolean;
    read_only?: boolean;
    default_value?: TCustomPropertyValue;
    format?: "YYYY-MM-DD" | "DD-MM-YYYY" | "MM-DD-YYYY" | "DD/MM/YYYY";
    [key: string]: unknown;
  };
  is_active: boolean;
  is_required: boolean;
  sort_order: number;
  options: TCustomPropertyOption[];
  type_settings: { type_id: string; project_issue_type_id: string; is_active: boolean; is_required: boolean }[];
  effective_is_active?: boolean;
  effective_is_required?: boolean;
};

export type TCustomPropertyList = {
  results: TCustomProperty[];
  count: number;
  can_manage: boolean;
};

export type TIssueCustomPropertyValues = { values: TCustomPropertyValues };
export type TCustomPropertyInput = Pick<TCustomProperty, "name" | "property_type"> &
  Partial<Pick<TCustomProperty, "description" | "config" | "is_active" | "is_required" | "sort_order">> & {
    options?: TCustomPropertyOptionInput[];
    type_id?: string;
  };
export type TCustomPropertyOptionInput = Pick<TCustomPropertyOption, "name"> &
  Partial<Pick<TCustomPropertyOption, "color" | "sort_order" | "is_active">>;
