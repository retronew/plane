/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import type { TSupportedFilterFieldConfigs, IFilterOption, TFilterValue } from "@plane/types";
import { cn } from "@plane/utils";

type TLoadOptionsProps<V extends TFilterValue> = {
  config: TSupportedFilterFieldConfigs<V>;
  setOptions: (options: IFilterOption<V>[]) => void;
  setLoading?: (loading: boolean) => void;
};

export const loadOptions = async <V extends TFilterValue>(props: TLoadOptionsProps<V>) => {
  const { config, setOptions, setLoading } = props;

  if ("getOptions" in config && Array.isArray(config.getOptions)) {
    setOptions(config.getOptions);
    return;
  }

  // if the config has a getOptions function, load the options
  if ("getOptions" in config && typeof config.getOptions === "function") {
    setLoading?.(true);
    try {
      const result = await config.getOptions();
      setOptions(result);
    } catch (error) {
      console.error("Failed to load options:", error);
    } finally {
      setLoading?.(false);
    }
  }
};

export function renderFilterOptionIcon(option: IFilterOption<string>) {
  return option.icon ? (
    <span className={cn("inline-flex shrink-0 items-center justify-center leading-none", option.iconClassName)}>
      {option.icon}
    </span>
  ) : undefined;
}
