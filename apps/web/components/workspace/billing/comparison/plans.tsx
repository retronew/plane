/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Translation, translate } from "@plane/i18n";
import { ChatOutline, MailOutline } from "@makeplane/propel/icons";
import { EProductSubscriptionEnum } from "@plane/types";
// plane imports
import { cn } from "@plane/utils";

export type TPlanFeatureData = React.ReactNode | boolean | null;

// TODO: we should change this type and use TProductSubscriptionType instead. Need changes in common constants.
export type TPlanePlans = "free" | "one" | "pro" | "business" | "enterprise";

export type TPlanDetail = {
  id: EProductSubscriptionEnum;
  name: React.ReactNode;
  monthlyPrice?: number;
  yearlyPrice?: number;
  monthlyPriceSecondaryDescription?: React.ReactNode;
  yearlyPriceSecondaryDescription?: React.ReactNode;
  buttonCTA?: React.ReactNode;
  isActive: boolean;
};

type TPlanFeatureDetails = {
  title: React.ReactNode;
  description?: React.ReactNode;
  selfHostedDescription?: React.ReactNode;
  comingSoon?: boolean;
  selfHostedOnly?: boolean;
  cloud: Record<TPlanePlans, TPlanFeatureData>;
  "self-hosted"?: Record<TPlanePlans, TPlanFeatureData>;
};

type TPlansComparisonDetails = {
  id: string;
  title: React.ReactNode;
  comingSoon?: boolean;
  cloudOnly?: boolean;
  selfHostedOnly?: boolean;
  features: TPlanFeatureDetails[];
};

type PlanePlans = {
  planDetails: Record<TPlanePlans, TPlanDetail>;
  planHighlights: Record<TPlanePlans, string[]>;
  planComparison: TPlansComparisonDetails[];
};

function ForumIcon({ className }: { className?: string }) {
  return <ChatOutline className={cn(className, "size-5 text-secondary")} />;
}

export function ComingSoonBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "w-fit rounded-sm bg-accent-primary px-1.5 py-0.5 text-9 font-semibold whitespace-nowrap text-on-color",
        className
      )}
    >
      <Translation translationKey="web.ui.coming_soon" />
    </span>
  );
}

export const PLANS_LIST: TPlanePlans[] = ["free", "one", "pro", "business", "enterprise"];

export const PLANS_COMPARISON_LIST: TPlansComparisonDetails[] = [
  {
    id: "project-work-tracking",
    get title() {
      return translate("web.plan_features.project_work_tracking");
    },
    features: [
      {
        get title() {
          return translate("web.plan_features.projects");
        },
        get description() {
          return translate("web.plan_features.add_projects_to_house_work_items_cycles_and_modules");
        },
        cloud: {
          free: true,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.work_items");
        },
        get description() {
          return translate(
            "web.plan_features.add_work_via_work_items_set_properties_for_tracking_and_add_to_cycles_or_modules"
          );
        },
        cloud: {
          free: true,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.comments");
        },
        get description() {
          return translate(
            "web.plan_features.respond_to_work_items_mention_members_and_brainstorm_together_without_leaving_plane"
          );
        },
        cloud: {
          free: true,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.cycles");
        },
        get description() {
          return translate("web.plan_features.track_work_in_timeboxes_with_differing_frequency");
        },
        cloud: {
          free: true,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.modules");
        },
        get description() {
          return translate("web.plan_features.group_replicable_work_in_modules_with_their_own_leads");
        },
        cloud: {
          free: true,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.intake");
        },
        get description() {
          return translate(
            "web.plan_features.see_suggestions_and_feedback_from_viewers_and_guests_before_you_decide_to_add_them_to_your"
          );
        },
        cloud: {
          free: true,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.estimates");
        },
        get description() {
          return translate("web.plan_features.measure_effort_in_points_in_a_system_that_works_for_you");
        },
        cloud: {
          get free() {
            return translate("web.plan_features.basic");
          },
          get one() {
            return translate("web.plan_features.basic");
          },
          get pro() {
            return translate("web.plan_features.advanced");
          },
          get business() {
            return translate("web.plan_features.advanced");
          },
          get enterprise() {
            return translate("web.plan_features.advanced");
          },
        },
      },
    ],
  },
  {
    id: "project-work-management",
    get title() {
      return translate("web.plan_features.project_work_management");
    },
    features: [
      {
        get title() {
          return translate("web.plan_features.bulk_ops");
        },
        get description() {
          return translate(
            "web.plan_features.add_several_work_items_to_cycles_or_modules_transfer_them_or_edit_their_properties"
          );
        },
        cloud: {
          free: false,
          get one() {
            return translate("web.plan_features.limited_props");
          },
          get pro() {
            return translate("web.plan_features.all_props");
          },
          business: (
            <span className="flex flex-col items-end gap-1 lg:items-center">
              <ComingSoonBadge />
              <Translation translationKey="web.ui.work_item_transfers" />
            </span>
          ),
          enterprise: (
            <span className="flex flex-col items-end gap-1 lg:items-center">
              <ComingSoonBadge />
              <Translation translationKey="web.ui.work_item_transfers" />
            </span>
          ),
        },
      },
      {
        get title() {
          return translate("web.plan_features.time_tracking_worklogs");
        },
        get description() {
          return translate("web.plan_features.track_time_per_work_item_see_aggregated_reports_and_filter_by_need");
        },
        cloud: {
          free: false,
          get one() {
            return translate("web.plan_features.basic");
          },
          get pro() {
            return translate("web.plan_features.historical_timesheets");
          },
          get business() {
            return translate("web.plan_features.historical_timesheets_and_approvals");
          },
          get enterprise() {
            return translate("web.plan_features.historical_timesheets_and_approvals");
          },
        },
      },
      {
        get title() {
          return translate("web.plan_features.active_cycles");
        },
        get description() {
          return translate("web.plan_features.see_all_running_cycles_across_all_projects_or_soon_in_a_single_project");
        },
        cloud: {
          free: false,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.work_item_types");
        },
        get description() {
          return translate("web.plan_features.create_your_own_work_item_types_with_your_own_properties");
        },
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.custom_properties");
        },
        get description() {
          return translate("web.plan_features.create_your_own_properties_and_apply_them_to_your_workspace_or_project");
        },
        cloud: {
          free: false,
          one: false,
          get pro() {
            return translate("web.plan_features.project_level_custom_properties");
          },
          get business() {
            return translate("web.plan_features.workspace_level_properties_and_roll_ups");
          },
          get enterprise() {
            return translate("web.plan_features.workspace_level_properties_and_roll_ups");
          },
        },
      },
      {
        get title() {
          return translate("web.plan_features.dependencies_in_gantt");
        },
        get description() {
          return translate("web.plan_features.adjust_timelines_for_dependent_work_items_visually_on_our_gantt_layout");
        },
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.work_item_transfers");
        },
        get description() {
          return translate("web.plan_features.move_a_work_item_from_a_project_or_a_cycle_to_another");
        },
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.auto_transfer_cycle_work_items");
        },
        get description() {
          return translate(
            "web.plan_features.transfer_incomplete_work_items_from_a_completed_cycle_to_the_next_cycle_or_to_the_default_"
          );
        },
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.epics");
        },
        get description() {
          return translate(
            "web.plan_features.organize_long_term_work_in_epics_that_house_work_items_cycles_and_modules"
          );
        },
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.initiatives");
        },
        get description() {
          return translate("web.plan_features.create_initiatives_to_roll_up_several_epics");
        },
        comingSoon: true,
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.checkpoints");
        },
        get description() {
          return translate(
            "web.plan_features.add_markers_to_projects_epics_and_initiatives_to_keep_your_team_on_track_and_report_on_pro"
          );
        },
        comingSoon: true,
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.module_overview");
        },
        get description() {
          return translate(
            "web.plan_features.like_cycle_overviews_see_relevant_details_and_progress_charts_for_each_module"
          );
        },
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.auto_assignment_in_modules");
        },
        get description() {
          return translate(
            "web.plan_features.choose_assignment_rules_for_work_items_in_a_module_including_linear_round_robin_or_capacit"
          );
        },
        cloud: {
          free: false,
          one: false,
          get pro() {
            return translate("web.plan_features.linear");
          },
          get business() {
            return translate("web.plan_features.round_robin_and_capacity");
          },
          get enterprise() {
            return translate("web.plan_features.round_robin_and_capacity");
          },
        },
      },
      // {
      //   title: "Project Overview",
      //   description: "See just-in-time snapshots of your project with\nessential metrics.",
      //   comingSoon: true,
      //   cloud: {
      //     free: false,
      //     one: false,
      //     pro: true,
      //     business: true,
      //     enterprise: true,
      //   },
      // },
      {
        get title() {
          return translate("web.plan_features.public_private_and_secret_projects");
        },
        get description() {
          return translate(
            "web.plan_features.public_projects_are_visible_and_accessible_to_everyone_private_ones_are_visible_but_need_a"
          );
        },
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.state_of_projects");
        },
        get description() {
          return translate(
            "web.plan_features.see_all_projects_laid_across_states_that_highlight_those_that_need_attention_and_those_on_"
          );
        },
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      // {
      //   title: "Project Updates",
      //   description:
      //     "Keep stakeholders in the loop with a dedicated\nspace for updates that everyone in the project can\nsee.",
      //   comingSoon: true,
      //   cloud: {
      //     free: false,
      //     one: false,
      //     pro: true,
      //     business: true,
      //     enterprise: true,
      //   },
      // },
      {
        get title() {
          return translate("web.plan_features.pre_defined_work_item_templates");
        },
        get description() {
          return translate(
            "web.plan_features.choose_from_our_available_work_item_templates_that_customize_work_item_types_and_propertie"
          );
        },
        comingSoon: true,
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.teamspace_cycles");
        },
        get description() {
          return translate("web.plan_features.see_multiple_cycles_in_multiple_projects_at_once");
        },
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.project_templates");
        },
        get description() {
          return translate(
            "web.plan_features.save_states_workflows_automation_and_other_project_settings_into_templates"
          );
        },
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.baselines_and_deviations");
        },
        get description() {
          return translate(
            "web.plan_features.declare_baselines_for_how_your_projects_progress_and_zoom_in_on_deviations"
          );
        },
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.scheduled_comms");
        },
        get description() {
          return translate("web.plan_features.schedule_reports_notifications_and_messages_to_third_party_tools");
        },
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.intake_assignees");
        },
        get description() {
          return translate("web.plan_features.assign_approved_intake_work_items_to_a_member_by_default");
        },
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.custom_slas");
        },
        get description() {
          return translate("web.plan_features.set_sla_matrices_for_time_sensitive_work_items");
        },
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.intake_forms");
        },
        get description() {
          return translate("web.plan_features.take_intake_work_items_from_externally_accessible_web_forms");
        },
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.emails_for_intake");
        },
        get description() {
          return translate(
            "web.plan_features.get_an_email_address_for_reporting_work_items_directly_into_a_project_s_intake"
          );
        },
        comingSoon: true,
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
    ],
  },
  {
    id: "visualization",
    get title() {
      return translate("web.plan_features.visualization");
    },
    features: [
      {
        get title() {
          return translate("web.plan_features.layouts");
        },
        get description() {
          return translate(
            "web.plan_features.choose_from_the_list_the_board_the_calendar_the_gantt_or_the_spreadsheet_layout_for_your_w"
          );
        },
        cloud: {
          free: true,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.views");
        },
        get description() {
          return translate("web.plan_features.save_sort_filter_and_display_options_on_a_layout_to_a_view");
        },
        cloud: {
          free: true,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.shared_views");
        },
        get description() {
          return translate("web.plan_features.choose_a_few_members_to_share_a_view_with");
        },
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.publish_views");
        },
        get description() {
          return translate("web.plan_features.put_a_view_on_the_internet_and_let_your_customers_interact_with_them");
        },
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.dashboards_and_widgets");
        },
        get description() {
          return translate("web.plan_features.create_your_own_dashboards_with_custom_widgets_and_data_types");
        },
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
    ],
  },
  {
    id: "analytics-reports",
    get title() {
      return translate("web.plan_features.analytics_reports");
    },
    features: [
      {
        get title() {
          return translate("web.plan_features.progress_charts");
        },
        get description() {
          return translate(
            "web.plan_features.track_progress_in_cycles_modules_and_overviews_throughout_plane_without_switching_to_dashb"
          );
        },
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.cycle_reports");
        },
        get description() {
          return translate(
            "web.plan_features.get_on_demand_cycle_reports_during_and_after_a_cycle_revisit_reports_anytime_from_permalin"
          );
        },
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.insights");
        },
        get description() {
          return translate("web.plan_features.hindsight_on_demand_insights_foresights");
        },
        comingSoon: true,
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      // {
      //   title: "Time Capsule",
      //   description: "Go back in your project's timeline and see point-in-\ntime snapshots.",
      //   comingSoon: true,
      //   cloud: {
      //     free: false,
      //     one: false,
      //     pro: false,
      //     business: true,
      //     enterprise: true,
      //   },
      // },
      {
        get title() {
          return translate("web.plan_features.advanced_pages_analytics");
        },
        get description() {
          return translate(
            "web.plan_features.see_who_s_viewing_sharing_and_commenting_on_your_pages_along_with_other_useful_info"
          );
        },
        comingSoon: true,
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.custom_reports");
        },
        get description() {
          return translate(
            "web.plan_features.generate_reports_by_any_dimension_and_metric_across_your_project_or_workspace"
          );
        },
        comingSoon: true,
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
    ],
  },
  {
    id: "navigation",
    get title() {
      return translate("web.plan_features.navigation");
    },
    features: [
      {
        title: "Power K",
        get description() {
          return translate("web.plan_features.access_a_keyboard_first_gateway_to_almost_anything_in_plane");
        },
        cloud: {
          free: true,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      // {
      //   title: "Search",
      //   description: "Search via natural-language queries, operators, or\nPQL",
      //   cloud: {
      //     free: "Basic text search",
      //     one: "Basic text search",
      //     pro: (
      //       <span className="flex flex-col items-end lg:items-center gap-1">
      //         <span className="bg-[#3f76ff] text-on-color font-semibold text-9 p-0.5 w-fit whitespace-nowrap rounded-xs">
      //           COMING SOON
      //         </span>
      //         Operator capsules from text or PQL
      //       </span>
      //     ),
      //     business: (
      //       <span className="flex flex-col items-end lg:items-center gap-1">
      //         <span className="bg-[#3f76ff] text-on-color font-semibold text-9 p-0.5 w-fit whitespace-nowrap rounded-xs">
      //           COMING SOON
      //         </span>
      //         Operator capsules from text or PQL
      //       </span>
      //     ),
      //     enterprise: (
      //       <span className="flex flex-col items-end lg:items-center gap-1">
      //         <span className="bg-[#3f76ff] text-on-color font-semibold text-9 p-0.5 w-fit whitespace-nowrap rounded-xs">
      //           COMING SOON
      //         </span>
      //         Operator capsules from text or PQL
      //       </span>
      //     ),
      //   },
      // },
      {
        title: "PQL",
        get description() {
          return translate(
            "web.plan_features.write_plane_query_language_in_search_with_support_for_boolean_operators_soon_you_can_write"
          );
        },
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
    ],
  },
  {
    id: "workspace-user-management",
    get title() {
      return translate("web.plan_features.workspace_and_user_management");
    },
    features: [
      {
        get title() {
          return translate("web.plan_features.member_limit");
        },
        get description() {
          return translate("web.plan_features.number_of_seats_that_can_use_project_and_work_management_features");
        },
        get selfHostedDescription() {
          return translate(
            "web.plan_features.number_of_users_that_our_standard_infra_supports_increase_infra_to_get_more_users"
          );
        },
        cloud: {
          free: "12",
          one: "",
          get pro() {
            return translate("web.plan_features.unlimited");
          },
          get business() {
            return translate("web.plan_features.unlimited");
          },
          get enterprise() {
            return translate("web.plan_features.unlimited");
          },
        },
        "self-hosted": {
          free: "~50",
          one: "~50",
          pro: "~200",
          business: "~200",
          get enterprise() {
            return translate("web.plan_features.unlimited");
          },
        },
      },
      {
        get title() {
          return translate("web.plan_features.roles");
        },
        get description() {
          return translate(
            "web.plan_features.choose_from_one_of_four_pre_defined_roles_or_create_custom_ones_with_rbac"
          );
        },
        cloud: {
          get free() {
            return translate("web.plan_features.basic");
          },
          get one() {
            return translate("web.plan_features.basic");
          },
          get pro() {
            return translate("web.plan_features.pre_defined_roles");
          },
          business: "RBAC",
          enterprise: "GAC",
        },
      },
      {
        get title() {
          return translate("web.plan_features.guests");
        },
        get description() {
          return translate("web.plan_features.let_some_users_see_everything_or_just_their_work_items_in_a_project");
        },
        cloud: {
          free: false,
          get one() {
            return translate("web.plan_features.5_per_paid_member");
          },
          get pro() {
            return translate("web.plan_features.5_per_paid_member");
          },
          get business() {
            return translate("web.plan_features.5_per_paid_member");
          },
          get enterprise() {
            return translate("web.plan_features.5_per_paid_member");
          },
        },
      },
      {
        get title() {
          return translate("web.plan_features.approvals");
        },
        get description() {
          return translate("web.plan_features.set_workspace_project_and_work_item_type_approvals_to_designated_admins");
        },
        comingSoon: true,
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.admin_interface");
        },
        get description() {
          return translate("web.plan_features.get_an_admin_overview_to_manage_workspace_and_project_settings");
        },
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.workspace_activity_logs");
        },
        get description() {
          return translate("web.plan_features.see_filterable_activity_logs_for_your_entire_workspace");
        },
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.api_enabled_audit_logs");
        },
        get description() {
          return translate(
            "web.plan_features.see_a_full_workspace_audit_log_and_use_apis_to_flag_plane_activity_in_compliance_systems"
          );
        },
        comingSoon: true,
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
    ],
  },
  {
    id: "automations-workflows",
    get title() {
      return translate("web.plan_features.automations_and_workflows");
    },
    features: [
      {
        get title() {
          return translate("web.plan_features.trigger_and_action");
        },
        get description() {
          return translate("web.plan_features.choose_a_trigger_and_a_corresponding_action_per_automation_flow");
        },
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.decisions_and_loops_automation");
        },
        get description() {
          return translate("web.plan_features.use_actions_as_triggers_indefinitely_in_an_automation_flow");
        },
        comingSoon: true,
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.number_of_automations");
        },
        get description() {
          return translate("web.plan_features.total_number_of_automation_flows_in_your_workspace");
        },
        cloud: {
          free: false,
          one: false,
          pro: "5,000",
          business: "10,000",
          get enterprise() {
            return translate("web.plan_features.unlimited");
          },
        },
      },
    ],
  },
  {
    id: "knowledge-management",
    get title() {
      return translate("web.plan_features.knowledge_management");
    },
    features: [
      {
        get title() {
          return translate("web.plan_features.pages");
        },
        get description() {
          return translate("web.plan_features.build_knowledge_bases_for_your_teams_which_are_accessible_shareable");
        },
        cloud: {
          free: true,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.real_time_collab");
        },
        get description() {
          return translate("web.plan_features.edit_a_page_together_with_members_in_your_project_team_or_workspace");
        },
        cloud: {
          free: false,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.work_item_embeds");
        },
        get description() {
          return translate("web.plan_features.embed_work_items_from_any_project_you_are_a_member_of");
        },
        cloud: {
          free: false,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.link_to_work_items");
        },
        get description() {
          return translate("web.plan_features.link_pages_in_work_items_in_a_separate_section_in_work_item_details");
        },
        cloud: {
          free: false,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.publish");
        },
        get description() {
          return translate(
            "web.plan_features.put_your_pages_on_the_web_for_external_users_and_let_them_comment_without_signing_into_you"
          );
        },
        cloud: {
          free: false,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.wiki");
        },
        get description() {
          return translate("web.plan_features.create_company_wide_wikis_or_knowledge_bases_without_creating_a_project");
        },
        cloud: {
          free: false,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.exports");
        },
        get description() {
          return translate("web.plan_features.export_page_content_into_pdfs_or_word_compatible_docs");
        },
        cloud: {
          free: false,
          one: false,
          get pro() {
            return translate("web.plan_features.one_download_at_a_time");
          },
          get business() {
            return translate("web.plan_features.queued_downloads");
          },
          get enterprise() {
            return translate("web.plan_features.queued_downloads");
          },
        },
      },
      {
        get title() {
          return translate("web.plan_features.templates");
        },
        get description() {
          return translate("web.plan_features.use_pages_as_templates_for_your_project_team_or_workspace");
        },
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.versions");
        },
        get description() {
          return translate("web.plan_features.see_restorable_version_of_edits_to_your_pages");
        },
        cloud: {
          free: false,
          one: false,
          get pro() {
            return translate("web.plan_features.2_days");
          },
          get business() {
            return translate("web.plan_features.3_months");
          },
          get enterprise() {
            return translate("web.plan_features.unlimited");
          },
        },
      },
      {
        get title() {
          return translate("web.plan_features.databases_formulas");
        },
        get description() {
          return translate(
            "web.plan_features.put_databases_and_formulas_into_a_page_without_worrying_about_losing_text_images_or_other_"
          );
        },
        comingSoon: true,
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.nested_pages");
        },
        get description() {
          return translate(
            "web.plan_features.pages_inside_a_page_organize_your_pages_as_you_see_fit_for_the_progressive_disclosure"
          );
        },
        comingSoon: true,
        cloud: {
          free: false,
          one: false,
          pro: false,
          get business() {
            return translate("web.plan_features.word_compatible_other_format_downloads");
          },
          get enterprise() {
            return translate("web.plan_features.word_compatible_other_format_downloads");
          },
        },
      },
    ],
  },
  {
    id: "importers",
    get title() {
      return translate("web.plan_features.importers");
    },
    features: [
      {
        title: "Jira",
        get description() {
          return translate("web.plan_features.import_your_work_items_and_members_from_jira");
        },
        cloud: {
          get free() {
            return translate("web.plan_features.without_custom_props");
          },
          get one() {
            return translate("web.plan_features.without_custom_props");
          },
          get pro() {
            return translate("web.plan_features.with_custom_props");
          },
          get business() {
            return translate("web.plan_features.with_custom_props");
          },
          get enterprise() {
            return translate("web.plan_features.with_custom_props");
          },
        },
      },
      {
        title: "GitHub",
        get description() {
          return translate("web.plan_features.import_your_work_items_and_members_from_github");
        },
        cloud: {
          get free() {
            return translate("web.plan_features.without_custom_props");
          },
          get one() {
            return translate("web.plan_features.without_custom_props");
          },
          get pro() {
            return translate("web.plan_features.with_custom_props");
          },
          get business() {
            return translate("web.plan_features.with_custom_props");
          },
          get enterprise() {
            return translate("web.plan_features.with_custom_props");
          },
        },
      },
    ],
  },
  {
    id: "integrations",
    get title() {
      return translate("web.plan_features.integrations");
    },
    comingSoon: true,
    features: [
      {
        title: "GitHub",
        get description() {
          return translate(
            "web.plan_features.sync_plane_work_items_and_states_to_github_work_items_and_states_update_github_automatical"
          );
        },
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Slack",
        get description() {
          return translate(
            "web.plan_features.get_plane_activity_in_slack_and_use_commands_in_slack_to_make_changes_in_plane"
          );
        },
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Zapier",
        get description() {
          return translate("web.plan_features.run_if_then_else_automations_using_zapier");
        },
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Zendesk",
        get description() {
          return translate("web.plan_features.create_plane_work_items_from_zendesk_tickets");
        },
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Freshdesk",
        get description() {
          return translate("web.plan_features.create_plane_work_items_from_freshdesk_tickets");
        },
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
    ],
  },
  {
    id: "storage",
    get title() {
      return translate("web.plan_features.storage");
    },
    cloudOnly: true,
    features: [
      {
        get title() {
          return translate("web.plan_features.space");
        },
        get description() {
          return translate("web.plan_features.total_storage_allowed_per_workspace");
        },
        cloud: {
          free: "5GB",
          one: false,
          pro: "1 TB",
          business: "5 TB",
          get enterprise() {
            return translate("web.plan_features.custom");
          },
        },
      },
      {
        get title() {
          return translate("web.plan_features.max_file_size");
        },
        get description() {
          return translate("web.plan_features.limit_for_uploads_to_your_workspace");
        },
        cloud: {
          free: "5 MB",
          one: false,
          pro: "100 MB",
          business: "200 MB",
          get enterprise() {
            return translate("web.plan_features.custom");
          },
        },
      },
    ],
  },
  {
    id: "security",
    get title() {
      return translate("web.plan_features.security");
    },
    features: [
      {
        title: "SAML",
        get description() {
          return translate(
            "web.plan_features.get_the_officially_supported_saml_implementation_and_make_plane_secure_with_any_idp"
          );
        },
        cloud: {
          free: false,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "OIDC",
        get description() {
          return translate(
            "web.plan_features.get_the_officially_supported_oidc_implementation_and_make_plane_secure_with_any_idp"
          );
        },
        selfHostedOnly: true,
        cloud: {
          free: false,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.domain_security");
        },
        get description() {
          return translate(
            "web.plan_features.choose_other_domains_that_can_authenticate_into_your_plane_workspace_or_restrict_all_but_o"
          );
        },
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.two_factor_authentication_and_passkeys");
        },
        get description() {
          return translate(
            "web.plan_features.secure_your_plane_workspace_with_device_dependent_two_factor_authentication_and_passkeys"
          );
        },
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.password_policy");
        },
        get description() {
          return translate("web.plan_features.set_custom_password_policies_in_line_with_your_compliance_requirements");
        },
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "LDAP",
        get description() {
          return translate(
            "web.plan_features.get_our_official_ldap_implementation_and_secure_your_plane_workspace_with_your_ldap_server"
          );
        },
        comingSoon: true,
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: false,
          enterprise: true,
        },
      },
    ],
  },
  {
    id: "self-hosted",
    get title() {
      return translate("web.plan_features.self_hosted");
    },
    selfHostedOnly: true,
    features: [
      {
        get title() {
          return translate("web.plan_features.god_mode");
        },
        get description() {
          return translate(
            "web.plan_features.manage_your_self_hosted_plane_instance_better_with_an_instance_admin_interface"
          );
        },
        cloud: {
          free: true,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.one_click_deployment");
        },
        get description() {
          return translate(
            "web.plan_features.install_and_deploy_your_self_hosted_plane_to_any_private_cloud_with_a_single_line_command"
          );
        },
        cloud: {
          free: false,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.digital_ocean_marketplace_app");
        },
        get description() {
          return translate("web.plan_features.get_our_digital_ocean_compatible_app_on_their_marketplace");
        },
        cloud: {
          free: false,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.heroku_platform_app");
        },
        get description() {
          return translate("web.plan_features.get_our_heroku_platform_compatible_app_and_deploy_to_heroku_easily");
        },
        cloud: {
          free: false,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "AWS AMI",
        get description() {
          return translate("web.plan_features.get_our_ami_compatible_app_from_the_aws_marketplace");
        },
        cloud: {
          free: false,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        get title() {
          return translate("web.plan_features.private_deployments");
        },
        get description() {
          return translate("web.plan_features.get_our_hosted_cloud_app_on_a_private_cloud_managed_by_us");
        },
        comingSoon: true,
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: false,
          enterprise: true,
        },
      },
    ],
  },
  {
    id: "support",
    get title() {
      return translate("web.plan_features.support");
    },
    features: [
      {
        get title() {
          return translate("web.plan_features.channels");
        },
        get description() {
          return translate("web.plan_features.get_access_to_one_or_more_support_channels_by_your_plan");
        },
        cloud: {
          free: (
            <>
              <ForumIcon className="size-4" />
            </>
          ),
          one: (
            <div className="flex items-center gap-1">
              <MailOutline className="size-4 flex-shrink-0" />
              <ForumIcon className="size-4 flex-shrink-0" />
            </div>
          ),
          pro: (
            <div className="flex items-center gap-1">
              <MailOutline className="size-4 flex-shrink-0" />
              <ForumIcon className="size-4 flex-shrink-0" />
              <ChatOutline className="size-4 flex-shrink-0" />
            </div>
          ),
          get business() {
            return translate("web.plan_features.full_suite_professional_services");
          },
          get enterprise() {
            return translate("web.plan_features.full_suite_professional_services");
          },
        },
      },
      {
        title: "SLA",
        description: (
          <>
            <Translation
              translationKey="web.ui.sla_description"
              components={{
                request: (
                  <a
                    href="https://plane.so/talk-to-sales"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    <Translation translationKey="web.ui.request_tiers" />
                  </a>
                ),
              }}
            />
          </>
        ),
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
    ],
  },
];

export const PLANE_PLANS: PlanePlans = {
  planDetails: {
    free: {
      id: EProductSubscriptionEnum.FREE,
      name: "Free",
      monthlyPrice: 0,
      yearlyPrice: 0,
      isActive: true,
    },
    one: {
      id: EProductSubscriptionEnum.ONE,
      name: "One",
      monthlyPrice: 799,
      yearlyPrice: 799,
      get monthlyPriceSecondaryDescription() {
        return translate("web.plan_features.per_workspace");
      },
      get yearlyPriceSecondaryDescription() {
        return translate("web.plan_features.per_workspace");
      },
      get buttonCTA() {
        return translate("web.plan_features.upgrade");
      },
      isActive: false,
    },
    pro: {
      id: EProductSubscriptionEnum.PRO,
      name: "Pro",
      monthlyPrice: 8,
      yearlyPrice: 6,
      get monthlyPriceSecondaryDescription() {
        return translate("web.plan_features.billed_monthly");
      },
      get yearlyPriceSecondaryDescription() {
        return translate("web.plan_features.billed_yearly");
      },
      get buttonCTA() {
        return translate("web.plan_features.upgrade");
      },
      isActive: true,
    },
    business: {
      id: EProductSubscriptionEnum.BUSINESS,
      name: "Business",
      get monthlyPriceSecondaryDescription() {
        return translate("web.plan_features.billed_monthly");
      },
      get yearlyPriceSecondaryDescription() {
        return translate("web.plan_features.billed_yearly");
      },
      get buttonCTA() {
        return translate("web.plan_features.talk_to_sales");
      },
      isActive: false,
    },
    enterprise: {
      id: EProductSubscriptionEnum.ENTERPRISE,
      name: "Enterprise",
      get monthlyPriceSecondaryDescription() {
        return translate("web.plan_features.billed_monthly");
      },
      get yearlyPriceSecondaryDescription() {
        return translate("web.plan_features.billed_yearly");
      },
      get buttonCTA() {
        return translate("web.plan_features.talk_to_sales");
      },
      isActive: false,
    },
  },
  planHighlights: {
    get free() {
      return [
        translate("web.plan_features.upto_12_users"),
        translate("web.plan_features.pages"),
        translate("web.plan_features.unlimited_projects"),
        translate("web.plan_features.unlimited_cycles_and_modules"),
      ];
    },
    get one() {
      return [
        translate("web.plan_features.upto_50_users"),
        translate("web.plan_features.oidc_and_saml"),
        translate("web.plan_features.active_cycles"),
        translate("web.plan_features.limited_time_tracking"),
      ];
    },
    get pro() {
      return [
        translate("web.plan_features.unlimited_users"),
        translate("web.plan_features.custom_work_items_properties"),
        translate("web.plan_features.work_item_templates"),
        translate("web.plan_features.full_time_tracking"),
      ];
    },
    get business() {
      return [
        "RBAC",
        translate("web.plan_features.project_templates"),
        translate("web.plan_features.baselines_and_deviations"),
        translate("web.plan_features.custom_reports"),
      ];
    },
    get enterprise() {
      return [
        translate("web.plan_features.private_managed_deployments"),
        "GAC",
        translate("web.plan_features.ldap_support"),
        translate("web.plan_features.databases_formulas"),
      ];
    },
  },
  planComparison: PLANS_COMPARISON_LIST,
};
