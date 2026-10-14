/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TCopyField } from "@/components/common/copy-field";
import { CopyField } from "@/components/common/copy-field";

type Props = {
  title: string;
  fields: TCopyField[];
};

/**
 * Right-hand column of a provider config dialog: the values Plane gives the provider (origin,
 * callback URLs, …). Shared so every provider lays them out the same way.
 */
export function PlaneDetailsPanel(props: Props) {
  const { title, fields } = props;

  return (
    <div className="flex flex-col gap-y-4">
      <div className="text-14 font-medium">{title}</div>
      <div className="flex flex-col gap-y-6 rounded-lg bg-layer-1 p-4">
        {fields.map((field) => (
          <CopyField key={field.key} label={field.label} url={field.url} description={field.description} />
        ))}
      </div>
    </div>
  );
}
