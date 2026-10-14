/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";

const TOKEN = "\u0000node\u0000";

type Props = {
  /** Translates the full sentence; called with the placeholder that marks where `node` goes */
  render: (placeholder: string) => string;
  node: ReactNode;
};

/**
 * Renders one translated sentence with a React node (e.g. a highlighted name)
 * at the position of its placeholder, so every locale controls its own word order
 * instead of the sentence being split into separately translated fragments.
 */
export function TranslationWithNode({ render, node }: Props) {
  const [before, after = ""] = render(TOKEN).split(TOKEN);
  return (
    <>
      {before}
      {node}
      {after}
    </>
  );
}
