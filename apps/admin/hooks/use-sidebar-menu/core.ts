/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { BrainCog } from "lucide-react";
// plane imports
import {
  LockOutline,
  MailOutline,
  MembersOutline,
  SettingsOutline,
  UserOutline,
  WorkspaceOutline,
} from "@makeplane/propel/icons";
// types
import type { TSidebarMenuItem } from "./types";

export type TCoreSidebarMenuKey = "general" | "users" | "admins" | "email" | "workspace" | "authentication" | "ai";

export const coreSidebarMenuLinks: Record<TCoreSidebarMenuKey, TSidebarMenuItem> = {
  general: {
    Icon: SettingsOutline,
    name: "admin.sidebar.general.name",
    description: "admin.sidebar.general.description",
    href: `/general/`,
  },
  users: {
    Icon: UserOutline,
    name: "admin.sidebar.users.name",
    description: "admin.sidebar.users.description",
    href: `/users/`,
  },
  admins: {
    Icon: MembersOutline,
    name: "admin.sidebar.admins.name",
    description: "admin.sidebar.admins.description",
    href: `/admins/`,
  },
  email: {
    Icon: MailOutline,
    name: "admin.sidebar.email.name",
    description: "admin.sidebar.email.description",
    href: `/email/`,
  },
  workspace: {
    Icon: WorkspaceOutline,
    name: "admin.sidebar.workspace.name",
    description: "admin.sidebar.workspace.description",
    href: `/workspace/`,
  },
  authentication: {
    Icon: LockOutline,
    name: "admin.sidebar.authentication.name",
    description: "admin.sidebar.authentication.description",
    href: `/authentication/`,
  },
  ai: {
    Icon: BrainCog,
    name: "admin.sidebar.ai.name",
    description: "admin.sidebar.ai.description",
    href: `/ai/`,
  },
};
