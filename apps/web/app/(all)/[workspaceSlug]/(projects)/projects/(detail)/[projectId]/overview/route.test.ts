/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RouteConfigEntry } from "@react-router/dev/routes";
import { matchRoutes } from "react-router";
import type { RouteObject } from "react-router";
import { expect, it } from "vitest";
import { coreRoutes } from "@/app/routes/core";

function toRoutes(entries: RouteConfigEntry[]): RouteObject[] {
  return entries.map(({ file, path: routePath, index, children }) =>
    index
      ? { id: file, path: routePath, index: true }
      : { id: file, path: routePath, children: children ? toRoutes(children) : undefined }
  );
}

it.each(["/acme/projects/project-1/overview", "/acme/projects/project-1/overview/"])(
  "resolves %s beneath the existing project permission layout and overview shell",
  (url) => {
    const matches = matchRoutes(toRoutes(coreRoutes), url);
    const projectRoot = "./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]";
    expect(matches?.slice(-3).map(({ route }) => route.id)).toEqual([
      `${projectRoot}/layout.tsx`,
      `${projectRoot}/overview/layout.tsx`,
      `${projectRoot}/overview/page.tsx`,
    ]);
    expect(matches?.at(-1)?.params).toMatchObject({ workspaceSlug: "acme", projectId: "project-1" });
    const appDirectory = fileURLToPath(new URL("../../../../../../../", import.meta.url));
    for (const match of matches ?? []) {
      expect(existsSync(path.resolve(appDirectory, match.route.id!))).toBe(true);
    }
  }
);
