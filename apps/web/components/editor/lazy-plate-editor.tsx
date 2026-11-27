/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { forwardRef, lazy, Suspense } from "react";
import type { ComponentProps } from "react";
import type { EditorRefApi } from "@plane/editor";
import type { PlateEditorWithRef as PlateEditorWithRefType } from "@plane/editor/plate";

const LazyPlateEditorImpl = lazy(() =>
  import("@plane/editor/plate").then((module) => ({ default: module.PlateEditorWithRef }))
);

export const LazyPlateEditor = forwardRef<EditorRefApi, ComponentProps<typeof PlateEditorWithRefType>>(
  function LazyPlateEditor(props, ref) {
    return (
      <Suspense fallback={<div className="min-h-16 w-full animate-pulse rounded-md bg-layer-1" />}>
        <LazyPlateEditorImpl {...props} ref={ref} />
      </Suspense>
    );
  }
);

LazyPlateEditor.displayName = "LazyPlateEditor";
