import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

async function stripFile(path) {
  const original = await readFile(path, "utf8");
  const updated = original
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/u, ""))
    .join("\n");
  if (updated !== original) {
    await writeFile(path, updated);
  }
}

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
    } else if (entry.isFile() && path.endsWith(".js")) {
      await stripFile(path);
    }
  }
}

await walk("api");
