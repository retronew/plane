/* eslint-disable no-await-in-loop -- Preserve deterministic filesystem traversal order. */
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function collectFiles(dir, prefix = "") {
  const entries = [];
  for (const item of (await readdir(dir, { withFileTypes: true })).toSorted((a, b) =>
    a.name.localeCompare(b.name, "en")
  )) {
    if (item.name === ".DS_Store") continue;
    const name = prefix + item.name;
    if (item.isDirectory()) entries.push(...(await collectFiles(resolve(dir, item.name), `${name}/`)));
    else if (item.isFile()) entries.push([name, await readFile(resolve(dir, item.name))]);
    else throw new Error(`Unsupported source entry: ${name}`);
  }
  return entries;
}
