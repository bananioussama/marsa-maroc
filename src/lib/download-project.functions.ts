import { createServerFn } from "@tanstack/react-start";
import { readFile } from "fs/promises";
import { join } from "path";

const PROJECT_FILES = [
  "README.md",
  "package.json",
  "tsconfig.json",
  "vite.config.ts",
  "components.json",
  "src/styles.css",
  "src/router.tsx",
  "src/routes/__root.tsx",
  "src/routes/index.tsx",
  "src/start.ts",
  "src/server.ts",
  "src/hooks/use-mobile.tsx",
  "src/lib/utils.ts",
  "public/robots.txt",
];

export const getProjectSourceFiles = createServerFn({ method: "GET" })
  .handler(async () => {
    const files: Record<string, string> = {};
    const errors: string[] = [];

    for (const relativePath of PROJECT_FILES) {
      try {
        const fullPath = join(process.cwd(), relativePath);
        const content = await readFile(fullPath, "utf-8");
        files[relativePath] = content;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${relativePath}: ${message}`);
      }
    }

    return { files, errors, included: Object.keys(files) };
  });
