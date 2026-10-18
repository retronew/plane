import type { IState } from "../state";

export type TWorkflowState = Pick<IState, "id" | "name" | "color" | "group"> & {
  sequence?: number;
  allow_creation: boolean;
};
export type TWorkflowStep = {
  script_version_id: string;
  phase: "pre" | "post";
  outcome: "transition" | "approve" | "reject";
};
export type TWorkflowMemberSnapshot = { id: string; name: string };
export type TWorkflowTransition = {
  id: string;
  source_id: string;
  destination_id: string;
  member_ids: string[];
  kind?: "transition" | "approval";
  reject_state_id?: string | null;
  approver_mode?: "all" | "explicit";
  approver_ids?: string[];
  approvers?: TWorkflowMemberSnapshot[];
  version?: number;
  steps?: TWorkflowStep[];
};
export type TProjectWorkflow = {
  id: string;
  workflow_id?: string;
  name?: string;
  description?: string;
  is_default?: boolean;
  enabled: boolean;
  is_active: boolean;
  version?: number;
  policy_version?: number;
  initial_state_id: string | null;
  effective_initial_state_id: string | null;
  can_manage: boolean;
  state_ids?: string[];
  issue_type_ids?: string[];
  states: TWorkflowState[];
  transitions: TWorkflowTransition[];
};
export type TProjectWorkflowList = {
  results: TProjectWorkflow[];
  count: number;
  enabled: boolean;
  policy_version: number;
  can_manage: boolean;
};
export type TProjectIssueType = {
  id: string;
  project_issue_type_id: string;
  name: string;
  description?: string;
  logo_props?: Record<string, unknown>;
  level?: number;
  is_epic?: boolean;
  properties_count?: number;
  is_default: boolean;
  is_active: boolean;
  workflow_id: string | null;
};
export type TProjectIssueTypeList = {
  results: TProjectIssueType[];
  count: number;
  policy_version: number;
  can_manage: boolean;
};
export type TProjectIssueHierarchy = {
  type_id_map?: Record<string, string>;
  enabled: boolean;
  default_level: number;
  policy_version: number;
  can_manage: boolean;
  levels: number[];
  issue_types: TProjectIssueType[];
};
export type THierarchyRequest = {
  enabled: boolean;
  default_level: number;
  policy_version: number;
  type_levels: { type_id: string; level: number }[];
};
export type THierarchyPreview = THierarchyRequest & {
  levels: number[];
  conflict_count: number;
  examples: {
    kind: "issue" | "draft";
    id: string;
    name: string;
    parent_id: string;
    parent_name: string;
    level: number;
    parent_level: number;
    reason: string;
  }[];
  token: string;
};
export type THierarchyApplyResult = {
  applied: true;
  detached_count: number;
  policy_version: number;
  config: TProjectIssueHierarchy;
};
export type TWorkflowImpactRequest = {
  operation: "bind_type" | "states" | "delete" | "enable" | "remove_type";
  workflow_id?: string;
  type_id?: string;
  state_ids?: string[];
  state_mapping?: Record<string, string>;
  enabled?: boolean;
  is_active?: boolean;
};
export type TWorkflowImpact = {
  token: string;
  policy_version: number;
  affected_count: number;
  examples: { id: string; name: string; state_id: string; type_id: string | null }[];
  required_state_ids: string[];
  invalidated_approval_count: number;
  warnings: string[];
  state_mapping: Record<string, string>;
};
export type TWorkflowRuleSnapshot = {
  [field: string]: unknown;
  id?: string;
  source?: { id: string; name: string };
  destination?: { id: string; name: string };
  source_name?: string;
  destination_name?: string;
  member_mode?: "all" | "explicit";
  members?: TWorkflowMemberSnapshot[];
  member_ids?: string[];
  kind?: "transition" | "approval";
  reject_state?: { id: string; name: string } | null;
  approver_mode?: "all" | "explicit";
  approvers?: TWorkflowMemberSnapshot[];
};
export type TWorkflowActivity = {
  id: string;
  action: string;
  data: {
    schema_version?: number;
    before?: TWorkflowRuleSnapshot | null;
    after?: TWorkflowRuleSnapshot | null;
    state_name?: string;
    source_name?: string;
    destination_name?: string;
    value?: boolean;
    member_ids?: string[];
  };
  workflow_id?: string;
  workflow_name?: string;
  actor_name: string;
  actor_id: string | null;
  created_at: string;
};
export type TWorkflowHistoryPage = {
  results: TWorkflowActivity[];
  next_offset: number | null;
  next_cursor?: string | null;
  watermark?: string;
  count: number;
};
export type TWorkflowApproval = {
  id: string;
  issue_id: string;
  workflow_id: string;
  source_id: string;
  entry_sequence: number;
  status: string;
  version: number;
  branches: TWorkflowTransition[];
  can_decide: boolean;
  decision: { outcome: "approve" | "reject"; transition_id: string; actor_id: string; at: string } | null;
  created_at: string;
};
export type TWorkflowScriptVersion = {
  id: string;
  version: number;
  source: string;
  capabilities: string[];
  http_policy: TWorkflowHttpPolicy;
  created_at: string;
};
export type TWorkflowHttpPolicy = { origins: string[]; methods: string[]; credential_id?: string };
export type TWorkflowScript = {
  id: string;
  name: string;
  description: string;
  versions: TWorkflowScriptVersion[];
};
export type TWorkflowCredential = { id: string; name: string; header_name: string; origin: string };
export type TWorkflowExecution = {
  id: string;
  status: string;
  phase?: "pre" | "post";
  outcome?: string;
  issue_id?: string | null;
  attempt?: number;
  dry_run?: boolean;
  draft_hash?: string;
  created_at?: string;
  error?: unknown;
  logs?: unknown[];
  actions?: unknown[];
  steps?: unknown[];
  [field: string]: unknown;
};
