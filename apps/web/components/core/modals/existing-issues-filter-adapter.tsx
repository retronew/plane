import { PriorityOutline, StartDateOutline, DueDateOutline, StateOutline } from "@makeplane/propel/icons";
import { PriorityIcon, StateGroupIcon } from "@plane/blocks/icons";
import { DATE_AFTER_FILTER_OPTIONS } from "@plane/constants";
import { translate } from "@plane/i18n";
import { FilterInstance } from "@plane/shared-state";
import type {
  IFilterAdapter,
  TFilterConditionNode,
  TFilterExpression,
  TFilterValue,
  TFilterConfig,
} from "@plane/types";
import { COLLECTION_OPERATOR, COMPARISON_OPERATOR, EQUALITY_OPERATOR, FILTER_FIELD_TYPE } from "@plane/types";
import {
  extractConditions,
  getPriorityFilterConfig,
  getStateGroupFilterConfig,
  renderFormattedDate,
  toFilterArray,
} from "@plane/utils";
import type { ExistingIssueFilters } from "./existing-issues-filters";

type Field = keyof ExistingIssueFilters;
type Condition = TFilterConditionNode<Field, TFilterValue>;
const fields: Field[] = ["state_group", "priority", "start_date", "target_date"];

function dateMode(values: string[]) {
  const absolute = values.every((value) => /^\d{4}-\d{2}-\d{2};(before|after)$/.test(value));
  if (
    absolute &&
    values.length === 2 &&
    values.some((value) => value.endsWith(";after")) &&
    values.some((value) => value.endsWith(";before"))
  )
    return "range";
  if (absolute && values.length === 1) return values[0].endsWith(";before") ? "before" : "after";
  return "relative";
}

/** The candidate endpoint still consumes its original arrays, never a rich-filter payload. */
export function createExistingIssueFilterAdapter(
  source: ExistingIssueFilters
): IFilterAdapter<Field, ExistingIssueFilters> {
  return {
    toInternal(value) {
      const children: Condition[] = fields
        .filter((field) => value[field].length > 0)
        .map((field) => {
          const values = value[field];
          if (field === "state_group" || field === "priority")
            return { id: field, type: "condition", property: field, operator: COLLECTION_OPERATOR.IN, value: values };
          const mode = dateMode(values);
          return {
            id: field,
            type: "condition",
            property: field,
            operator:
              mode === "range"
                ? COMPARISON_OPERATOR.RANGE
                : mode === "relative"
                  ? COLLECTION_OPERATOR.IN
                  : EQUALITY_OPERATOR.EXACT,
            value:
              mode === "range"
                ? [
                    values.find((encoded) => encoded.endsWith(";after"))!.split(";")[0],
                    values.find((encoded) => encoded.endsWith(";before"))!.split(";")[0],
                  ]
                : mode === "relative"
                  ? values
                  : values[0].split(";")[0],
          };
        });
      return children.length ? { id: "candidate-filters", type: "group", logicalOperator: "and", children } : null;
    },
    toExternal(expression: TFilterExpression<Field> | null) {
      const result: ExistingIssueFilters = { state_group: [], priority: [], start_date: [], target_date: [] };
      for (const condition of expression ? extractConditions(expression) : []) {
        const field = condition.property;
        const values = toFilterArray(condition.value).filter((value): value is string => typeof value === "string");
        if (field === "state_group" || field === "priority" || condition.operator === COLLECTION_OPERATOR.IN)
          result[field] = values;
        else if (condition.operator === COMPARISON_OPERATOR.RANGE)
          result[field] = values.length === 2 ? [`${values[0]};after`, `${values[1]};before`] : [];
        else
          result[field] = values.map(
            (value) => `${value};${dateMode(source[field]) === "before" ? "before" : "after"}`
          );
      }
      // Preserve byte-for-byte encodings (and boundary order) for untouched fields.
      const initial = this.toInternal(source);
      for (const condition of initial ? extractConditions(initial) : []) {
        const current = expression
          ? extractConditions(expression).find((item) => item.property === condition.property)
          : undefined;
        if (
          current &&
          current.operator === condition.operator &&
          JSON.stringify(current.value) === JSON.stringify(condition.value)
        )
          result[condition.property] = source[condition.property];
      }
      return result;
    },
  };
}

export function createExistingIssueFilterInstance(
  value: ExistingIssueFilters,
  onChange: (value: ExistingIssueFilters) => void
) {
  const filter = new FilterInstance({
    adapter: createExistingIssueFilterAdapter(value),
    initialExpression: value,
    onExpressionChange: onChange,
  });
  const selectionParams = {
    isEnabled: true,
    allowNegative: false,
    allowedOperators: new Set([COLLECTION_OPERATOR.IN]),
  };
  const configs: TFilterConfig<Field>[] = [
    getStateGroupFilterConfig<Field>("state_group")({
      ...selectionParams,
      filterIcon: StateOutline,
      getOptionIcon: (group) => <StateGroupIcon stateGroup={group} />,
    }),
    getPriorityFilterConfig<Field>("priority")({
      ...selectionParams,
      filterIcon: PriorityOutline,
      getOptionIcon: (priority) => <PriorityIcon priority={priority} className="size-3.5" />,
    }),
  ];
  for (const field of ["start_date", "target_date"] as const) {
    const mode = dateMode(value[field]);
    const operator =
      mode === "range"
        ? COMPARISON_OPERATOR.RANGE
        : mode === "relative"
          ? COLLECTION_OPERATOR.IN
          : EQUALITY_OPERATOR.EXACT;
    configs.push({
      id: field,
      label: translate(field === "start_date" ? "web.start_date" : "web.target_date"),
      icon: field === "start_date" ? StartDateOutline : DueDateOutline,
      isEnabled: true,
      supportedOperatorConfigsMap: new Map([
        [
          operator,
          mode === "relative"
            ? {
                type: FILTER_FIELD_TYPE.MULTI_SELECT,
                isOperatorEnabled: true,
                allowNegative: false,
                singleValueOperator: COLLECTION_OPERATOR.IN,
                getOptions: () => {
                  const options = DATE_AFTER_FILTER_OPTIONS.map((option) => ({
                    id: option.value,
                    value: option.value,
                    label: option.name,
                  }));
                  for (const encoded of value[field]) {
                    if (!options.some((option) => option.value === encoded)) {
                      const [date, direction] = encoded.split(";");
                      options.push({
                        id: encoded,
                        value: encoded,
                        label: `${translate(direction === "before" ? "web.before" : "web.after")} ${renderFormattedDate(date) ?? date}`,
                      });
                    }
                  }
                  return options;
                },
              }
            : {
                type: mode === "range" ? FILTER_FIELD_TYPE.DATE_RANGE : FILTER_FIELD_TYPE.DATE,
                isOperatorEnabled: true,
                allowNegative: false,
                ...(mode === "range"
                  ? {}
                  : { operatorLabel: translate(mode === "before" ? "web.before" : "web.after") }),
              },
        ],
      ]),
    });
  }
  filter.configManager.registerAll(configs);
  return filter;
}
