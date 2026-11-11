import { API_BASE_URL } from "@plane/constants";
import { APIService } from "./api.service";

export type MemberWorkStatus = "all" | "overdue" | "late_completed" | "justified" | "unjustified" | "unreviewed";
export type MemberWorkFilters = { projectIds: string[]; startDate?: string; endDate?: string };
export type MemberWorkRow = {
  id: string;
  name: string;
  avatar_url: string | null;
  project_count: number;
  projects: { id: string; name: string }[];
  assigned: number;
  unstarted: number;
  started: number;
  completed: number;
  cancelled: number;
  overdue: number;
  late_completed: number;
  justified: number;
  unjustified: number;
  unreviewed: number;
};
export type MemberWorkResponse = {
  rows: MemberWorkRow[];
  scope: {
    start_date: string | null;
    end_date: string | null;
    timezone: "project";
    basis: "target_date";
    assignment: "current";
  };
};
export type MemberWorkItem = {
  id: string;
  name: string;
  sequence_id: number;
  project_id: string;
  project_name: string;
  project_identifier: string;
  target_date: string | null;
  completed_at: string | null;
  state_name: string;
  state_group: string;
  reason_status: "justified" | "unjustified" | "unreviewed";
  reason_comment_id: string | null;
};
export type MemberWorkDetailResponse = { results: MemberWorkItem[]; count: number; next_page: number | null };

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function memberWorkParams({ projectIds, startDate, endDate }: MemberWorkFilters) {
  if (
    (startDate || endDate) &&
    (!startDate || !endDate || !isDate(startDate) || !isDate(endDate) || startDate > endDate)
  ) {
    throw new Error("Member work dates must be a valid paired YYYY-MM-DD range");
  }
  return {
    // oxlint-disable-next-line unicorn/no-array-sort -- ES2022 lib; sort a fresh copy.
    ...(projectIds.length ? { project_ids: [...new Set(projectIds)].sort().join(",") } : {}),
    ...(startDate && endDate ? { start_date: startDate, end_date: endDate } : {}),
  };
}
export function memberWorkItemHref(slug: string, item: MemberWorkItem, comment = false) {
  return `/${slug}/browse/${item.project_identifier}-${item.sequence_id}/${comment && item.reason_comment_id ? `#comment-${item.reason_comment_id}` : ""}`;
}
export class MemberWorkService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }
  async getOverview(slug: string, filters: MemberWorkFilters): Promise<MemberWorkResponse> {
    const response = await this.get(`/api/workspaces/${slug}/member-work/`, { params: memberWorkParams(filters) });
    return response.data;
  }
  async getMember(
    slug: string,
    userId: string,
    filters: MemberWorkFilters,
    status: MemberWorkStatus,
    page = 1
  ): Promise<MemberWorkDetailResponse> {
    const response = await this.get(`/api/workspaces/${slug}/member-work/${userId}/`, {
      params: { ...memberWorkParams(filters), status, page, page_size: 20 },
    });
    return response.data;
  }
}
