import { CycleDateFilter } from "./start-date";
import type { ComponentProps } from "react";

export function FilterEndDate(props: Omit<ComponentProps<typeof CycleDateFilter>, "field">) {
  return <CycleDateFilter {...props} field="end_date" />;
}
