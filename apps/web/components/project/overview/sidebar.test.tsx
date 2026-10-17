/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import type { IProject } from "@plane/types";
import { ProjectOverviewSidebar } from "./sidebar";

vi.mock("./properties", () => ({ ProjectOverviewProperties: () => <h2>Properties content</h2> }));
vi.mock("./updates", () => ({
  ProjectOverviewUpdates: ({ project }: { project: IProject }) => <h2>Updates for {project.id}</h2>,
}));
vi.mock("./activity", () => ({
  ProjectOverviewActivity: ({ projectId }: { projectId: string }) => <h2>Activity for {projectId}</h2>,
}));
beforeEach(async () => {
  await setLanguage("en");
});
afterEach(async () => {
  await setLanguage("en");
});
it("switches between properties and the real project-scoped updates and activity panels", async () => {
  render(<ProjectOverviewSidebar project={{ id: "project" } as IProject} workspaceSlug="workspace" disabled={false} />);
  expect(screen.getByRole("heading", { name: "Properties content" })).toBeDefined();
  fireEvent.click(screen.getByRole("tab", { name: "Updates" }));
  expect(await screen.findByRole("heading", { name: "Updates for project" })).toBeDefined();
  fireEvent.click(screen.getByRole("tab", { name: "Activity" }));
  expect(await screen.findByRole("heading", { name: "Activity for project" })).toBeDefined();
  fireEvent.click(screen.getByRole("tab", { name: "Properties" }));
  expect(await screen.findByRole("heading", { name: "Properties content" })).toBeDefined();
});
