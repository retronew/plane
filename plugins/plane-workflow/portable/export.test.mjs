/* eslint-disable no-await-in-loop -- Ordered filesystem traversal is intentionally sequential. */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { collectFiles } from "./files.mjs";
import { DISTRIBUTION_REPO, EXPORTED_PATHS, exportDistribution, sourceRoot } from "./export.mjs";

async function withCheckout(run) {
  const dir = await mkdtemp(resolve(tmpdir(), "plane-plugins-"));
  try {
    await mkdir(resolve(dir, ".git"));
    await writeFile(resolve(dir, ".git", "HEAD"), "ref: refs/heads/main\n");
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("exports only the marketplaces and plugins, replacing stale files", async () => {
  await withCheckout(async (dir) => {
    await writeFile(resolve(dir, "stale.txt"), "old");
    await exportDistribution(dir, "abc1234");
    assert.equal(await readFile(resolve(dir, ".git", "HEAD"), "utf8"), "ref: refs/heads/main\n");
    assert.deepEqual((await readdir(dir)).toSorted(), [
      ".agents",
      ".claude-plugin",
      ".git",
      ".gitattributes",
      "LICENSE.txt",
      "README.md",
      "plugins",
    ]);
    for (const path of EXPORTED_PATHS) {
      const source = resolve(sourceRoot, path);
      if ((await stat(source)).isFile()) {
        assert.deepEqual(await readFile(resolve(dir, path)), await readFile(source));
        continue;
      }
      const expected = (await collectFiles(source)).filter(([name]) => !name.startsWith("portable/"));
      assert.deepEqual(await collectFiles(resolve(dir, path)), expected);
    }
    await assert.rejects(stat(resolve(dir, "plugins/plane-workflow/portable")));
    const readme = await readFile(resolve(dir, "README.md"), "utf8");
    assert.match(readme, new RegExp(`claude plugin marketplace add ${DISTRIBUTION_REPO}`));
    assert.match(readme, /retronew\/plane@abc1234/);
  });
});

test("marketplace sources resolve inside the distribution repository", async () => {
  await withCheckout(async (dir) => {
    await exportDistribution(dir);
    const claude = JSON.parse(await readFile(resolve(dir, ".claude-plugin/marketplace.json"), "utf8"));
    for (const entry of claude.plugins)
      assert.ok((await stat(resolve(dir, entry.source, ".claude-plugin/plugin.json"))).isFile());
    const openai = JSON.parse(await readFile(resolve(dir, ".agents/plugins/marketplace.json"), "utf8"));
    for (const entry of openai.plugins)
      assert.ok((await stat(resolve(dir, entry.source.path, ".codex-plugin/plugin.json"))).isFile());
  });
});

test("refuses targets that are not a separate git checkout", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "plane-plugins-"));
  try {
    await writeFile(resolve(dir, "keep.txt"), "keep");
    await assert.rejects(exportDistribution(dir), /Not a git checkout/);
    assert.equal(await readFile(resolve(dir, "keep.txt"), "utf8"), "keep");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  await assert.rejects(exportDistribution(sourceRoot), /outside the source repo/);
});
