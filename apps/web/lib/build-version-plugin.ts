import type { Plugin } from "vite";

export function buildVersionPlugin(buildId: string): Plugin {
  const source = JSON.stringify({ buildId });
  return {
    name: "plane-build-version",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split("?")[0] !== "/version.json") return next();
        response.setHeader("Content-Type", "application/json");
        response.setHeader("Cache-Control", "no-store");
        response.end(source);
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source });
    },
  };
}
