import { expect, it, vi } from "vitest";
import { CycleArchiveService } from "./cycle_archive.service";
import { ModuleArchiveService } from "./module_archive.service";

for (const kind of ["cycle", "module"] as const) {
  it(`preserves a ${kind} archive network error without an HTTP response for the retry UI`, async () => {
    const service = kind === "cycle" ? new CycleArchiveService() : new ModuleArchiveService();
    const error = new Error("Network error");
    vi.spyOn(service, "get").mockRejectedValueOnce(error);
    const request =
      service instanceof CycleArchiveService
        ? service.getArchivedCycles("workspace", "project")
        : service.getArchivedModules("workspace", "project");
    await expect(request).rejects.toBe(error);
  });
}
