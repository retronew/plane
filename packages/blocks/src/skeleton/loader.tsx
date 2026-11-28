/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
// helpers
import { cn } from "@plane/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
};

function Loader({ children, className = "" }: Props) {
  return <output className={cn("skeleton-delayed block", className)}>{children}</output>;
}

type ItemProps = {
  height?: string;
  width?: string;
  className?: string;
};

function Item({ height = "auto", width = "auto", className = "" }: ItemProps) {
  return <div className={cn("rounded-md bg-layer-3", className)} style={{ height: height, width: width }} />;
}

Loader.Item = Item;

Loader.displayName = "plane-ui-loader";

export { Loader };
