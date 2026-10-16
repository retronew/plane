import type { IState } from "../state";
export type TWorkflowState = {
  id: string;
  name: string;
  color: string;
  group: IState["group"];
  allow_creation: boolean;
};
export type TWorkflowTransition = {
  id: string;
  source_id: string;
  destination_id: string;
  member_ids: string[];
};
export type TProjectWorkflow = {
  id: string;
  enabled: boolean;
  is_active: boolean;
  initial_state_id: string | null;
  effective_initial_state_id: string | null;
  can_manage: boolean;
  states: TWorkflowState[];
  transitions: TWorkflowTransition[];
};
export type TWorkflowActivity = {
  id: string;
  action: string;
  data: {
    state_name?: string;
    source_name?: string;
    destination_name?: string;
    value?: boolean;
    member_ids?: string[];
  };
  actor_name: string;
  actor_id: string | null;
  created_at: string;
};
