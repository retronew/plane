/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Fragment, useId } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "./hooks/use-translation";

type TranslationProps = {
  translationKey: string;
  values?: Record<string, string | number>;
  components?: Record<string, ReactNode>;
};

/** ICU messages with named React-node placeholders, without parsing or injecting HTML. */
export function Translation({ translationKey, values, components }: TranslationProps) {
  const { t } = useTranslation();
  const id = useId().replace(/[^a-zA-Z0-9_]/g, "_");
  const entries = Object.entries(components ?? {});
  const tokens = entries.map((_, index) => `\uE000${id}:${index}\uE001`);
  const params = Object.fromEntries(entries.map(([name], index) => [name, tokens[index]]));
  let parts: ReactNode[] = [t(translationKey, { ...values, ...params })];
  for (const [index, token] of tokens.entries()) {
    parts = parts.flatMap((part, partIndex) => {
      if (typeof part !== "string") return [part];
      return part.split(token).flatMap((text, occurrence) =>
        occurrence === 0
          ? [text]
          : [
              // Each translated placeholder may occur more than once; its position identifies that occurrence.
              // oxlint-disable-next-line react/no-array-index-key
              <Fragment key={`${index}-${partIndex}-${occurrence}`}>{entries[index][1]}</Fragment>,
              text,
            ]
      );
    });
  }
  return <>{parts}</>;
}
