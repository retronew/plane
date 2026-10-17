/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ProjectsOutline } from "@makeplane/propel/icons";
import { Logo } from "./logo";
import type { LogoProps } from "./logo";

type ProjectLogoProps = Omit<LogoProps, "logo"> & {
  logo?: LogoProps["logo"] | null;
};

/** Project-only empty state; configured logos keep the shared Logo renderer. */
export function ProjectLogo({ logo, size = 16, ...props }: ProjectLogoProps) {
  const hasLogo = (logo?.in_use === "emoji" && logo.emoji?.value) || (logo?.in_use === "icon" && logo.icon?.name);

  if (!hasLogo) {
    return (
      <ProjectsOutline aria-hidden="true" className="shrink-0 text-primary" style={{ width: size, height: size }} />
    );
  }

  return <Logo logo={logo ?? undefined} size={size} {...props} />;
}
