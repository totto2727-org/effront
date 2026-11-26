import { Data, Effect, FileSystem, Path, Predicate, Schema, Stream } from "effect";
import { ChildProcess } from "effect/process";
import { expect } from "vitest";
import vitePlusPackage from "vite-plus/package.json" with { type: "json" };

import { createProject } from "./init.ts";
import type { Platform } from "./init.ts";

const stringFields = Schema.Record(Schema.String, Schema.String);
const Manifest = Schema.StructWithRest(
  Schema.Struct({
    dependencies: Schema.optionalKey(stringFields),
    devDependencies: Schema.optionalKey(stringFields),
    name: Schema.String,
    packageManager: Schema.String,
    scripts: Schema.optionalKey(stringFields),
  }),
  [Schema.Record(Schema.String, Schema.Json)],
);
const PackedManifest = Schema.Struct({
  bin: Schema.Struct({ "create-effront": Schema.String }),
});
const decodeManifest = Schema.decodeEffect(Schema.fromJsonString(Manifest));
const decodePacked = Schema.decodeEffect(Schema.fromJsonString(PackedManifest));
export const decodeJson = Schema.decodeEffect(Schema.fromJsonString(Schema.JsonObject));

export const sourceWorkspace = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const workspace = yield* path.fromFileUrl(new URL("../../../", import.meta.url));
  const owner = yield* path.fromFileUrl(new URL("../", import.meta.url));
  return { fs, owner, path, workspace };
});

export const starterWorkspace = Effect.fnUntraced(function* (prefix: string) {
  const source = yield* sourceWorkspace;
  const temporaryParent = source.path.join(source.workspace, "tmp");
  yield* source.fs.makeDirectory(temporaryParent, { recursive: true });
  const directory = yield* source.fs.makeTempDirectoryScoped({
    directory: temporaryParent,
    prefix,
  });
  return { ...source, directory };
});

export const readProjectManifest = Effect.fnUntraced(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const text = yield* fs.readFileString(path.join(directory, "package.json"));
  return yield* decodeManifest(text);
});

export const readPackedManifest = Effect.fnUntraced(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const text = yield* fs.readFileString(path.join(directory, "package.json"));
  return yield* decodePacked(text);
});

class StarterProcessFailure extends Data.TaggedError("StarterProcessFailure")<{
  code: number;
  executable: string;
  stderr: string;
  stdout: string;
}> {}

export const commandOutput = Effect.fnUntraced(function* (
  executable: string,
  args: string[],
  cwd: string,
) {
  const command = ChildProcess.make(executable, args, { cwd });
  const { exitCode, stderr, stdout } = yield* command;
  const output = yield* Effect.all(
    {
      code: exitCode,
      stderr: stderr.pipe(Stream.decodeText, Stream.mkString),
      stdout: stdout.pipe(Stream.decodeText, Stream.mkString),
    },
    { concurrency: "unbounded" },
  );
  const success = 0;
  if (output.code !== success) {
    return yield* new StarterProcessFailure({ ...output, executable });
  }
  return output.stdout;
}, Effect.scoped);

export const generateProject = Effect.fnUntraced(function* (directory: string, platform: Platform) {
  return yield* Effect.tryPromise(async () => createProject(directory, platform));
});

const installedVite = vitePlusPackage.version;
const installedVitest = vitePlusPackage.dependencies.vitest;

export const expectPnpmConfiguration = Effect.fnUntraced(function* (
  directory: string,
  platform?: Platform,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = yield* fs.readFileString(path.join(directory, "pnpm-workspace.yaml"));
  const workspace = Predicate.isNullish(platform);
  const workers = workspace || platform.includes("cloudflare");
  const expectedBuilds = [
    ...(workspace ? ["  bun: true"] : []),
    "  esbuild: true",
    ...(workers ? ["  workerd: true"] : []),
    "",
  ].join("\n");
  const expectedOverrides = [
    "overrides:",
    `  "vite@*": npm:@voidzero-dev/vite-plus-core@${installedVite}`,
    `  "vitest@*": ${installedVitest}`,
  ].join("\n");
  expect(file.replaceAll("'", '"')).toContain(expectedOverrides);
  expect(file).not.toMatch(/^minimumReleaseAge/mu);
  expect(file.split("allowBuilds:\n")[1]).toBe(expectedBuilds);
});
