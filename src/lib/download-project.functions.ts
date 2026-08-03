import { createServerFn } from "@tanstack/react-start";
import { readFile, readdir, stat } from "fs/promises";
import { join, relative } from "path";

const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".wrangler",
  ".lovable",
  "tmp",
  "temp",
]);

const EXCLUDE_FILES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  "bun.lock",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
]);

async function walk(dir: string, root: string, files: Record<string, string>, errors: string[]) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = relative(root, fullPath);

    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.has(entry.name)) {
        await walk(fullPath, root, files, errors);
      }
      continue;
    }

    if (!entry.isFile() || EXCLUDE_FILES.has(entry.name)) continue;

    try {
      const info = await stat(fullPath);
      if (info.size > 10 * 1024 * 1024) {
        errors.push(`${relPath}: fichier trop volumineux (>10 Mo)`);
        continue;
      }
      const content = await readFile(fullPath, "utf-8");
      files[relPath] = content;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${relPath}: ${message}`);
    }
  }
}

export const getProjectSourceFiles = createServerFn({ method: "GET" })
  .handler(async () => {
    const files: Record<string, string> = {};
    const errors: string[] = [];
    const root = process.cwd();

    await walk(root, root, files, errors);

    return { files, errors, included: Object.keys(files) };
  });
