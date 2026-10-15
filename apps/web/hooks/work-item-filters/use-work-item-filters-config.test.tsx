import { renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import { useWorkItemFiltersConfig } from "./use-work-item-filters-config";
const stores = vi.hoisted(() => ({
  project: {
    loader: "loaded",
    getProjectById: vi.fn((id) =>
      id === "project" ? { id, name: "项目", cycle_view: true, module_view: true } : undefined
    ),
  },
  cycle: { getCycleById: vi.fn(), fetchWorkspaceCycles: vi.fn() },
  module: { getModuleById: vi.fn(), fetchWorkspaceModules: vi.fn() },
  label: { getLabelById: vi.fn() },
  member: { getUserDetails: vi.fn() },
  state: { getStateById: vi.fn() },
}));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => stores.project }));
vi.mock("@/hooks/store/use-cycle", () => ({ useCycle: () => stores.cycle }));
vi.mock("@/hooks/store/use-module", () => ({ useModule: () => stores.module }));
vi.mock("@/hooks/store/use-label", () => ({ useLabel: () => stores.label }));
vi.mock("@/hooks/store/use-member", () => ({ useMember: () => stores.member }));
vi.mock("@/hooks/store/use-project-state", () => ({ useProjectState: () => stores.state }));
beforeEach(async () => {
  vi.clearAllMocks();
  await setLanguage("zh-CN");
});
function options(config: ReturnType<typeof useWorkItemFiltersConfig>["configs"][number]) {
  const field = config.supportedOperatorConfigsMap.get("in")!;
  if (!("getOptions" in field) || typeof field.getOptions !== "function") throw new Error("Missing loader");
  return field.getOptions;
}
it("exposes title, text, cycles and modules with lazy cached workspace data", async () => {
  stores.cycle.fetchWorkspaceCycles.mockResolvedValue([
    { id: "cycle", name: "周期", project_id: "project", status: "draft" },
  ]);
  stores.module.fetchWorkspaceModules.mockResolvedValue([{ id: "module", name: "模块", project_id: "project" }]);
  const { result, rerender } = renderHook(() =>
    useWorkItemFiltersConfig({ workspaceSlug: "workspace", allowedFilters: ["cycle_id", "module_id"] })
  );
  expect(stores.cycle.fetchWorkspaceCycles).not.toHaveBeenCalled();
  expect(result.current.configMap.name?.label).toBe("标题");
  expect(result.current.configMap.text?.supportedOperatorConfigsMap.has("icontains")).toBe(true);
  const cycle = result.current.configMap.cycle_id!;
  expect(cycle.isEnabled).toBe(true);
  const load = options(cycle);
  expect(await load()).toMatchObject([{ value: "cycle", label: "周期", description: "项目" }]);
  rerender();
  await options(result.current.configMap.cycle_id!)();
  expect(stores.cycle.fetchWorkspaceCycles).toHaveBeenCalledExactlyOnceWith("workspace");
  expect(await options(result.current.configMap.module_id!)()).toMatchObject([{ value: "module" }]);
  expect(stores.module.fetchWorkspaceModules).toHaveBeenCalledExactlyOnceWith("workspace");
});
it("retries failed workspace loads and shares in-flight requests", async () => {
  stores.cycle.fetchWorkspaceCycles.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([]);
  const { result } = renderHook(() =>
    useWorkItemFiltersConfig({ workspaceSlug: "workspace", allowedFilters: ["cycle_id"] })
  );
  const load = options(result.current.configMap.cycle_id!);
  await expect(load()).rejects.toThrow("offline");
  await Promise.all([load(), load()]);
  expect(stores.cycle.fetchWorkspaceCycles).toHaveBeenCalledTimes(2);
});
it("keeps project options scoped and respects disabled project capabilities", () => {
  const { result } = renderHook(() =>
    useWorkItemFiltersConfig({
      workspaceSlug: "workspace",
      projectId: "disabled",
      allowedFilters: ["cycle_id", "module_id"],
      cycleIds: [],
      moduleIds: [],
    })
  );
  expect(result.current.configMap.cycle_id?.isEnabled).toBe(false);
  expect(result.current.configMap.module_id?.isEnabled).toBe(false);
  expect(stores.cycle.fetchWorkspaceCycles).not.toHaveBeenCalled();
});
