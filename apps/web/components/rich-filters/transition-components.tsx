/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { CssTransition } from "@/components/core/css-transition";

type ElementTransitionProps = {
  children: React.ReactNode;
  show: boolean;
};

export const ElementTransition = observer(function ElementTransition(props: ElementTransitionProps) {
  return (
    <CssTransition
      show={props.show}
      transitionClassName="inline-flex items-center transition"
      enterClassName="duration-200 ease-out"
      leaveClassName="duration-150 ease-in"
      fromClassName="scale-95 opacity-0"
      toClassName="scale-100 opacity-100"
      leaveDurationMs={150}
    >
      {props.children}
    </CssTransition>
  );
});

type RowTransitionProps = {
  children: React.ReactNode;
  show: boolean;
};

export const RowTransition = observer(function RowTransition(props: RowTransitionProps) {
  return (
    <CssTransition
      show={props.show}
      transitionClassName="transition-all"
      enterClassName="duration-150 ease-out"
      leaveClassName="duration-100 ease-in"
      fromClassName="-translate-y-1 opacity-0"
      toClassName="translate-y-0 opacity-100"
      leaveDurationMs={100}
    >
      {props.children}
    </CssTransition>
  );
});
