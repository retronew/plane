// Build an isolated local-test marketplace without changing committed production artifacts.
import { cp, mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mcpConfig } from "./mcp-config.mjs";
const [destination, origin] = process.argv.slice(2);
if (!destination || !origin) throw new Error("Usage: node local-package.mjs <new-output-directory> <local-origin>");
const config = mcpConfig(origin, { allowLocal: true });
const output = resolve(destination);
await mkdir(output); // Refuse existing output: never overwrite another checkout.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
await cp(resolve(root, "plugins/plane-workflow-openai"), resolve(output, "plane-workflow"), { recursive: true });
await writeFile(resolve(output, "plane-workflow/mcp.json"), `${JSON.stringify(config, null, 2)}\n`);
await mkdir(resolve(output, ".agents/plugins"), { recursive: true });
await writeFile(
  resolve(output, ".agents/plugins/marketplace.json"),
  `${JSON.stringify(
    {
      name: "plane-local-test",
      interface: { displayName: "Plane 本地测试" },
      plugins: [
        {
          name: "plane-workflow",
          source: { source: "local", path: "./plane-workflow" },
          policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
          category: "Productivity",
        },
      ],
    },
    null,
    2
  )}\n`
);
console.log(`Local test marketplace: ${output}`);
