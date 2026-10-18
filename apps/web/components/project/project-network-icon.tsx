/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TNetworkChoiceIconKey } from "@plane/constants";
// plane imports
import { GlobeOutline, LockOutline } from "@makeplane/propel/icons";
import { cn } from "@plane/utils";

type Props = {
  iconKey: TNetworkChoiceIconKey;
  className?: string;
};

const PROJECT_NETWORK_ICONS = {
  Lock: LockOutline,
  Globe2: GlobeOutline,
} satisfies Record<TNetworkChoiceIconKey, typeof LockOutline>;

export function ProjectNetworkIcon(props: Props) {
  const { iconKey, className } = props;
  const Icon = PROJECT_NETWORK_ICONS[iconKey];
  if (!Icon) return null;

  return <Icon className={cn("h-3 w-3", className)} />;
}
