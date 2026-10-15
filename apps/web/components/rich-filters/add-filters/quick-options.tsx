/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { MenuRow, MenuSearchInput } from "@plane/blocks/select";
import { useTranslation } from "@plane/i18n";
import type { IFilterOption, TFilterValue, TSupportedFilterFieldConfigs } from "@plane/types";

/** Mounted by the shared hover flyout, so async sources are never fetched on menu render. */
export function QuickFilterOptions({
  config,
  onSelect,
}: {
  config: TSupportedFilterFieldConfigs;
  onSelect: (value: TFilterValue) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<IFilterOption<TFilterValue>[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const load = async (retryAttempt: number) => {
      // Defer updates until after the effect, including on retry.
      await Promise.resolve(retryAttempt);
      if (!active) return;
      setStatus("loading");
      try {
        const values =
          "getOptions" in config
            ? typeof config.getOptions === "function"
              ? await config.getOptions()
              : config.getOptions
            : [];
        if (active) {
          setOptions(values);
          setStatus("ready");
        }
      } catch {
        if (active) setStatus("error");
      }
    };
    void load(attempt);
    return () => {
      active = false;
    };
  }, [config, attempt]);
  const visible = options.filter((option) =>
    `${option.label} ${option.description ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())
  );
  return (
    <div className="flex max-h-[var(--available-height,calc(100dvh-2rem))] flex-col">
      <MenuSearchInput value={query} onChange={setQuery} placeholder={t("search")} />
      <div className="min-h-0 overflow-y-auto p-1" aria-live="polite">
        {status === "loading" ? (
          <p className="px-2 py-2 text-body-xs-regular text-tertiary">{t("common.loading")}</p>
        ) : status === "error" ? (
          <div className="p-2 text-body-xs-regular text-tertiary">
            {t("common.filter_fields.load_error")}
            <button type="button" className="ml-2 text-accent-primary" onClick={() => setAttempt((value) => value + 1)}>
              {t("common.retry")}
            </button>
          </div>
        ) : visible.length === 0 ? (
          <p className="px-2 py-2 text-body-xs-regular text-tertiary">{t("common.search.no_matching_results")}</p>
        ) : (
          visible.map((option) => (
            <MenuRow
              key={option.id}
              disabled={option.disabled}
              render={<button type="button" disabled={option.disabled} aria-label={option.label} />}
              onClick={() => onSelect(option.value)}
              className="h-8 text-body-xs-regular text-primary"
            >
              <span className="flex min-w-0 items-center gap-2">
                {option.icon && (
                  <span className="inline-flex size-4 shrink-0 items-center justify-center leading-none">
                    {option.icon}
                  </span>
                )}
                <span className="truncate">{option.label}</span>
              </span>
              {option.description && <span className="ml-2 max-w-20 truncate text-tertiary">{option.description}</span>}
            </MenuRow>
          ))
        )}
      </div>
    </div>
  );
}
