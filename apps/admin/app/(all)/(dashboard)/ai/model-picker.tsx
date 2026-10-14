/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxSearch,
  ComboboxTrigger,
} from "@makeplane/propel/components/combobox";
import { useTranslation } from "@plane/i18n";

type Props = {
  id: string;
  value: string;
  onChange: (model: string) => void;
  /** Models fetched from the provider; may be empty, in which case only typed IDs are offered */
  models: string[];
  placeholder: string;
};

/**
 * Searchable model picker. Lists the fetched models and, when the search text isn't one of them,
 * offers it as a custom model ID, so any model the provider serves can be entered by hand.
 */
export function ModelPicker(props: Props) {
  const { id, value, onChange, models, placeholder } = props;
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  const typed = query.trim();
  const needle = typed.toLowerCase();
  const matches = needle ? models.filter((model) => model.toLowerCase().includes(needle)) : models;
  const items = typed && !models.includes(typed) ? [typed, ...matches] : matches;

  return (
    <Combobox<string>
      items={items}
      value={value || null}
      onValueChange={(next) => {
        if (next) onChange(next);
      }}
      inputValue={query}
      onInputValueChange={(next) => setQuery(next)}
      // `items` is already filtered above (it also carries the typed custom entry)
      filter={null}
    >
      <ComboboxTrigger id={id} size="lg" placeholder={placeholder}>
        {value || undefined}
      </ComboboxTrigger>
      <ComboboxContent
        aria-label={t("admin.ai.llm_model")}
        search={<ComboboxSearch placeholder={t("admin.ai.search_model")} />}
      >
        <ComboboxEmpty>{models.length ? t("admin.ai.no_matching_models") : t("admin.ai.type_model_id")}</ComboboxEmpty>
        <ComboboxList aria-label={t("admin.ai.llm_model")}>
          {(model: string) => (
            <ComboboxItem
              key={model}
              value={model}
              label={model === typed && !models.includes(model) ? t("admin.ai.use_custom_model", { model }) : model}
            />
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
