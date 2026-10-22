// Export the plugin marketplaces into a checkout of the distribution repository
// (retronew/plane-plugins), so clients clone ~0.1 MB instead of the whole monorepo.
// Usage: node plugins/plane-workflow/portable/export.mjs <distribution-checkout> [source-sha]
/* eslint-disable no-await-in-loop -- Ordered filesystem export is intentionally sequential. */
import { cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const sourceRoot = resolve(here, "../../..");
export const DISTRIBUTION_REPO = "retronew/plane-plugins";
export const SOURCE_REPO = "retronew/plane";

// Everything the distribution repository contains, relative to both roots.
export const EXPORTED_PATHS = [
  ".claude-plugin/marketplace.json",
  ".agents/plugins/marketplace.json",
  "plugins/plane-workflow",
  "plugins/plane-workflow-openai",
];
// Build tooling and tests stay in the monorepo; clients never read them.
const EXCLUDED = new Set(["plugins/plane-workflow/portable"]);
const KEEP = new Set([".git"]);

function readme(sourceSha) {
  const origin = sourceSha ? `${SOURCE_REPO}@${sourceSha}` : SOURCE_REPO;
  return `# Plane plugins

Plugin marketplaces for the Plane workflow skills. Generated from [${origin}](https://github.com/${SOURCE_REPO}${sourceSha ? `/commit/${sourceSha}` : ""}) by \`plugins/plane-workflow/portable/export.mjs\`. Do not edit this repository directly; change the source repository instead.

| Client | Install |
| --- | --- |
| Claude Code | \`claude plugin marketplace add ${DISTRIBUTION_REPO}\` then \`claude plugin install plane-workflow@plane-ai\` |
| GitHub Copilot CLI | \`copilot plugin marketplace add ${DISTRIBUTION_REPO}\` then \`copilot plugin install plane-workflow@plane-ai\` |
| VS Code (agent plugins) | \`/plugin marketplace add ${DISTRIBUTION_REPO}\` then \`/plugin install plane-workflow@plane-ai\` |
| Codex | \`codex plugin marketplace add ${DISTRIBUTION_REPO}\` then \`codex plugin add plane-workflow@plane-openai\` |
| Claude Desktop / ChatGPT | Add the marketplace from \`https://github.com/${DISTRIBUTION_REPO}\` in the client's plugin settings |
| Other skills clients | \`npx skills add https://github.com/${DISTRIBUTION_REPO}/tree/main/plugins/plane-workflow/skills\` |

The OpenAI plugin includes an instance-bound OAuth MCP connection. Install it, connect, and sign in to Plane to authorize a workspace. API Token connections remain supported in clients with manual MCP configuration. No credentials are included.
`;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function exportDistribution(target, sourceSha = "") {
  const out = resolve(target);
  // Refuse to clean anything that is not a separate git checkout.
  if (!(await exists(resolve(out, ".git")))) throw new Error(`Not a git checkout: ${out}`);
  if (out === sourceRoot || out.startsWith(sourceRoot + sep)) throw new Error("Target must be outside the source repo");
  for (const entry of await readdir(out))
    if (!KEEP.has(entry)) await rm(resolve(out, entry), { recursive: true, force: true });

  for (const path of EXPORTED_PATHS) {
    await mkdir(dirname(resolve(out, path)), { recursive: true });
    await cp(resolve(sourceRoot, path), resolve(out, path), {
      recursive: true,
      filter: (source) => {
        const rel = relative(sourceRoot, source).split(sep).join("/");
        return !EXCLUDED.has(rel) && !rel.endsWith(".DS_Store");
      },
    });
  }
  await cp(resolve(sourceRoot, "LICENSE.txt"), resolve(out, "LICENSE.txt"));
  await writeFile(resolve(out, ".gitattributes"), "* text=auto eol=lf\n*.zip binary\n");
  await writeFile(resolve(out, "README.md"), readme(sourceSha));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [target, sourceSha] = process.argv.slice(2);
  if (!target) throw new Error("Usage: node export.mjs <distribution-checkout> [source-sha]");
  await exportDistribution(target, sourceSha);
  console.log(`Exported plugin marketplaces to ${resolve(target)}`);
}
