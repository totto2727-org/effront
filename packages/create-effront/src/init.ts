// oxlint-disable-next-line rules/no-node-imports -- Use the native exclusive-copy flag so a concurrent change cannot be overwritten.
import { constants } from "node:fs";
// oxlint-disable-next-line rules/no-node-imports -- Preserve exclusive creation, lstat symlink checks, and native file errors at the initializer boundary.
import { access, copyFile, lstat, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Synchronous project-name normalization uses the host's native path rules.
import path from "node:path";
import { Array, Data, Predicate, Schema } from "effect";

export const platforms = ["node", "bun", "cloudflare", "alchemy-cloudflare"] as const;
export type Platform = (typeof platforms)[number];

const templates = path.resolve(import.meta.dirname, "../templates");
const templateFileNames: Readonly<Record<string, string>> = {
  _gitignore: ".gitignore",
};
const ProjectName = Schema.String.check(Schema.isPattern(/^[a-z0-9]/u));
const isProjectName = Schema.is(ProjectName);
const isMissingPath = Schema.is(Schema.Struct({ code: Schema.Literal("ENOENT") }));

class ProjectInitError extends Data.TaggedError("ProjectInitError")<
  Readonly<{
    message: string;
  }>
> {}

export const projectName = (directory: string): string => {
  const name = path
    .basename(path.resolve(directory))
    .toLowerCase()
    .replaceAll(/[^a-z0-9._-]+/gu, "-")
    .replaceAll(/^[._-]+|[._-]+$/gu, "");
  if (!isProjectName(name)) {
    throw new ProjectInitError({ message: "Project directory must contain letters or numbers." });
  }
  return name;
};

const textTemplateSuffixes = [".json", ".ts", ".md"];

const copyTemplateFile = async (source: string, target: string, name: string): Promise<void> => {
  if (textTemplateSuffixes.some((suffix) => source.endsWith(suffix))) {
    const contents = await readFile(source, "utf8");
    await writeFile(target, contents.replaceAll("__PROJECT_NAME__", name), { flag: "wx" });
    return;
  }
  await copyFile(source, target, constants.COPYFILE_EXCL);
};

type TemplateCopy = Readonly<{ name: string; source: string; target: string }>;

const copyTemplate = async (copy: TemplateCopy): Promise<void> => {
  const entries = await readdir(copy.source, { withFileTypes: true });
  await Array.reduce(entries, Promise.resolve(), async (previous, entry) => {
    await previous;
    const from = path.join(copy.source, entry.name);
    const to = path.join(copy.target, templateFileNames[entry.name] ?? entry.name);
    if (entry.isDirectory()) {
      await mkdir(to, { recursive: true });
      await copyTemplate({ name: copy.name, source: from, target: to });
      return;
    }
    if (!entry.isFile()) {
      throw new ProjectInitError({ message: `Unsupported template entry: ${entry.name}` });
    }
    await copyTemplateFile(from, to, copy.name);
  });
};

const validateDestination = async (target: string): Promise<void> => {
  try {
    const stat = await lstat(target);
    if (!stat.isDirectory()) {
      throw new ProjectInitError({ message: `Target is not a directory: ${target}` });
    }
    const entries = await readdir(target);
    if (Array.isArrayNonEmpty(entries)) {
      throw new ProjectInitError({ message: `Target directory is not empty: ${target}` });
    }
  } catch (error) {
    if (!(Predicate.isError(error) && isMissingPath(error))) {
      throw error;
    }
  }
};

const prepareDestination = async (
  target: string,
  shared: string,
  selected: string,
): Promise<void> => {
  await access(shared);
  await access(selected);
  await mkdir(path.dirname(target), { recursive: true });
  await mkdir(target, { recursive: true });
};

/**
 * Populates an empty project directory with exclusive file creation.
 * @param {string} directory A destination on the local filesystem.
 * @param {Platform} platform The selected starter platform.
 * @returns {Promise<string>} The absolute path of the generated project.
 */
export const createProject = async (directory: string, platform: Platform): Promise<string> => {
  const target = path.resolve(directory);
  const name = projectName(target);
  await validateDestination(target);
  const shared = path.join(templates, "shared");
  const selected = path.join(templates, platform);
  await prepareDestination(target, shared, selected);
  await copyTemplate({ name, source: shared, target });
  await copyTemplate({ name, source: selected, target });
  return target;
};
