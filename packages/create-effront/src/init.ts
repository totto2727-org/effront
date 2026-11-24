import { constants } from "node:fs";
import { access, copyFile, lstat, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Array, Data, Predicate, Schema } from "effect";

export const platforms = ["node", "bun", "cloudflare", "alchemy-cloudflare"] as const;
export type Platform = (typeof platforms)[number];

const templates = fileURLToPath(new URL("../templates/", import.meta.url));
const templateFileNames: Readonly<Record<string, string>> = {
  _gitignore: ".gitignore",
};
const ProjectName = Schema.String.check(Schema.isPattern(/^[a-z0-9]/u));
const isProjectName = Schema.is(ProjectName);
const isMissingPath = Schema.is(Schema.Struct({ code: Schema.Literal("ENOENT") }));

class ProjectInitError extends Data.TaggedError("ProjectInitError")<{
  readonly message: string;
}> {}

export function projectName(directory: string): string {
  const name = basename(resolve(directory))
    .toLowerCase()
    .replaceAll(/[^a-z0-9._-]+/gu, "-")
    .replaceAll(/^[._-]+|[._-]+$/gu, "");
  if (!isProjectName(name)) {
    throw new ProjectInitError({ message: "Project directory must contain letters or numbers." });
  }
  return name;
}

async function copyTemplate(source: string, target: string, name: string): Promise<void> {
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(target, templateFileNames[entry.name] ?? entry.name);
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
      throw new ProjectInitError({ message: `Unsupported template entry: ${entry.name}` });
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
      throw new ProjectInitError({ message: `Target is not a directory: ${target}` });
    }
    if (Array.isArrayNonEmpty(await readdir(target))) {
      throw new ProjectInitError({ message: `Target directory is not empty: ${target}` });
    }
  } catch (cause) {
    if (!(Predicate.isError(cause) && isMissingPath(cause))) {
      throw cause;
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
