// oxlint-disable-next-line rules/no-node-imports -- This fixture invokes vp and tar to inspect real release archives.
import { execFile } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- The release test owns asynchronous Node filesystem and glob operations.
import { glob, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Paths are passed to native packaging commands on the current host.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- This Node release fixture converts its module URL to native paths.
import { fileURLToPath } from "node:url";

import { Cause, Exit, Predicate, Schema } from "effect";

const repository = fileURLToPath(new URL("../", import.meta.url));
const temporaryDirectory = path.join(repository, "tmp");
const NativeManifest = Schema.Struct({ exports: Schema.Unknown, version: Schema.String });
const decodeManifest = Schema.decodeExit(Schema.fromJsonString(NativeManifest));
const archiveTimeout = 25_000;

export const manifests = async (): Promise<string[]> =>
  Array.fromAsync(glob("packages/*/package.json", { cwd: repository }));

export const implicitIndices = async (): Promise<string[]> =>
  Array.fromAsync(
    glob("{packages,app,examples,tests}/**/index.{ts,tsx}", {
      cwd: repository,
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/tmp/**",
        "**/.runtime/**",
        "**/.alchemy/**",
        "**/test-results/**",
        "**/playwright-report/**",
      ],
    }),
  );

const commandOutput = async (file: string, args: string[], cwd = repository): Promise<string> => {
  const output = Promise.withResolvers<string>();
  // oxlint-disable-next-line promise/prefer-await-to-callbacks -- Native execFile reports stdout and errors through a callback, which this fixture adapts once.
  execFile(file, args, { cwd, encoding: "utf8", timeout: archiveTimeout }, (error, stdout) => {
    if (Predicate.isNotNullish(error)) {
      output.reject(error);
    } else {
      output.resolve(stdout);
    }
  });
  return output.promise;
};

const targets = (value: unknown): string[] => {
  if (Predicate.isString(value)) {
    return [value];
  }
  if (!Predicate.isObject(value)) {
    return [];
  }
  return Object.values(value).flatMap((target) => targets(target));
};

const manifestFrom = (text: string): typeof NativeManifest.Type => {
  const decoded = decodeManifest(text);
  if (Exit.isFailure(decoded)) {
    throw Cause.squash(decoded.cause);
  }
  return decoded.value;
};

export const synchronizedVersion = async (): Promise<string> => {
  const manifest = await readFile(path.join(repository, "packages/core/package.json"), "utf8");
  return manifestFrom(manifest).version;
};

type Archive = Readonly<{
  files: string[];
  targets: string[];
  version: string;
}>;

const readArchive = async (archive: string): Promise<Archive> => {
  const listing = await commandOutput("tar", ["-tzf", archive]);
  const published = await commandOutput("tar", ["-xOf", archive, "package/package.json"]);
  const manifest = manifestFrom(published);
  return {
    files: listing.split("\n"),
    targets: targets(manifest.exports),
    version: manifest.version,
  };
};

export const packManifest = async (manifest: string): Promise<Archive> => {
  await mkdir(temporaryDirectory, { recursive: true });
  const temporary = await mkdtemp(path.join(temporaryDirectory, "package-layout-"));
  try {
    const archive = path.join(temporary, "package.tgz");
    const packageDirectory = path.dirname(path.join(repository, manifest));
    await commandOutput("vp", ["pm", "pack", "--out", archive], packageDirectory);
    return await readArchive(archive);
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
};

export const forbiddenImplicitEntry = (target: string): boolean =>
  /^index\.(?:js|d\.ts)$/u.test(path.basename(target));
