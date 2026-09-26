import { constants } from "node:fs";
import { access, copyFile, lstat, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const platforms = ["node", "bun", "cloudflare", "alchemy-cloudflare"] as const;
export type Platform = (typeof platforms)[number];

const templates = fileURLToPath(new URL("../templates/", import.meta.url));

export function isPlatform(value: string): value is Platform {
  return platforms.some((platform) => platform === value);
}

export function projectName(directory: string): string {
  const name = basename(resolve(directory))
    .toLowerCase()
    .replaceAll(/[^a-z0-9._-]+/g, "-")
    .replaceAll(/^[._-]+|[._-]+$/g, "");
  if (!name || !/^[a-z0-9]/.test(name)) {
    throw new Error("Project directory must contain letters or numbers.");
  }
  return name;
}

async function copyTemplate(source: string, target: string, name: string): Promise<void> {
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(target, entry.name === "_gitignore" ? ".gitignore" : entry.name);
    if (entry.isDirectory()) {
      await mkdir(to, { recursive: true });
      await copyTemplate(from, to, name);
    } else if (entry.isFile()) {
      if (
        entry.name.endsWith(".json") ||
        entry.name.endsWith(".ts") ||
        entry.name.endsWith(".md")
      ) {
        const contents = await readFile(from, "utf8");
        await writeFile(to, contents.replaceAll("__PROJECT_NAME__", name), { flag: "wx" });
      } else {
        await copyFile(from, to, constants.COPYFILE_EXCL);
      }
    } else {
      throw new Error(`Unsupported template entry: ${entry.name}`);
    }
  }
}

/** Populate an empty project directory; existing contents are never overwritten. */
export async function createProject(directory: string, platform: Platform): Promise<string> {
  const target = resolve(directory);
  const name = projectName(target);
  try {
    const stat = await lstat(target);
    if (!stat.isDirectory()) {
      throw new Error(`Target is not a directory: ${target}`);
    }
    if ((await readdir(target)).length > 0) {
      throw new Error(`Target directory is not empty: ${target}`);
    }
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
  await access(join(templates, "shared"));
  await access(join(templates, platform));
  await mkdir(dirname(target), { recursive: true });
  await mkdir(target, { recursive: true });
  await copyTemplate(join(templates, "shared"), target, name);
  await copyTemplate(join(templates, platform), target, name);
  return target;
}
