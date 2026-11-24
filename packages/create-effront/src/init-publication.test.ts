import { NodeServices } from "@effect/platform-node";
import { live } from "@effect/vitest";
import { Effect, FileSystem, Path, Predicate, Schema } from "effect";
import { describe, expect } from "vitest";

import {
  commandOutput,
  decodeJson,
  expectPnpmConfiguration,
  generateProject,
  readPackedManifest,
  readProjectManifest,
  sourceWorkspace,
  starterWorkspace,
} from "./init-project.fixture.ts";
import { platforms } from "./init.ts";
import type { Platform } from "./init.ts";

const integrationTimeout = 30_000;
const failedLint = 1;
const standaloneFileCount = 4;
const otherFileCount = 5;
const decodeManager = Schema.decodeEffect(
  Schema.fromJsonString(Schema.Struct({ packageManager: Schema.String })),
);
const tracingProbe = [
  'import { Effect } from "effect";',
  "export const probe = Effect.fnUntraced(() => Effect.void);",
].join("\n");

const unpackStarter = Effect.fn(function* () {
  const source = yield* starterWorkspace("create-effront-publication-");
  const { directory, fs, owner, path } = source;
  const archive = path.join(directory, "create-effront.tgz");
  yield* commandOutput("vp", ["pm", "pack", "--out", archive], owner);
  yield* commandOutput("tar", ["-xf", archive, "-C", directory], directory);
  const packed = path.join(directory, "package");
  yield* fs.symlink(path.join(owner, "node_modules"), path.join(packed, "node_modules"));
  return { ...source, packed };
});

const packStarter = Effect.fn(function* () {
  const { directory, fs, packed, path, workspace } = yield* unpackStarter();
  const manifest = yield* readPackedManifest(packed);
  const entry = path.join(packed, manifest.bin["create-effront"]);
  const root = yield* fs.readFileString(path.join(workspace, "package.json"));
  const { packageManager } = yield* decodeManager(root);
  return { directory, entry, packageManager };
});

const alchemyImports = [
  'from "@effront/alchemy/cloudflare/application"',
  'import type application from "./entry.effront.tsx"',
  "makeApplicationHttpEffect<typeof application>()",
];

const readPackedAlchemy = Effect.fn(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const worker = yield* fs.readFileString(path.join(directory, "src/entry.workers.ts"));
  return {
    dynamicImport: worker.includes("import("),
    missingImports: alchemyImports.filter((expected) => !worker.includes(expected)),
  };
});

const readPackedStarter = Effect.fn(function* (
  packed: Effect.Success<ReturnType<typeof packStarter>>,
  platform: Platform,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.join(packed.directory, "generated", platform);
  yield* commandOutput(
    process.execPath,
    [packed.entry, directory, "--platform", platform],
    packed.directory,
  );
  const files = yield* fs.readDirectory(directory);
  const manifest = yield* readProjectManifest(directory);
  yield* expectPnpmConfiguration(directory, platform);
  const alchemy =
    platform === "alchemy-cloudflare" ? yield* readPackedAlchemy(directory) : undefined;
  return {
    alchemy,
    forwardedBunConfig: files.includes("bunfig.toml"),
    manager: manifest.packageManager,
    policyOverrides: Object.keys(manifest).filter(
      (key) => key === "overrides" || key === "trustedDependencies",
    ),
  };
});

describe("workspace package-manager settings", () => {
  live(
    "keeps required Vite+ overrides and lifecycle policy aligned with its installed toolchain",
    () =>
      Effect.gen(function* () {
        const { workspace } = yield* sourceWorkspace;
        yield* expectPnpmConfiguration(workspace);
      }).pipe(Effect.provide(NodeServices.layer)),
  );
});

describe("published CLI package", () => {
  live(
    "ships pnpm toolchain metadata through the published CLI for every platform",
    () =>
      Effect.gen(function* () {
        const packed = yield* packStarter();
        const results = yield* Effect.forEach(platforms, (platform) =>
          readPackedStarter(packed, platform),
        );
        const expected = platforms.map((platform) => ({
          alchemy:
            platform === "alchemy-cloudflare"
              ? { dynamicImport: false, missingImports: [] }
              : undefined,
          forwardedBunConfig: false,
          manager: packed.packageManager,
          policyOverrides: [],
        }));
        expect(results).toStrictEqual(expected);
      }).pipe(Effect.provide(NodeServices.layer)),
    integrationTimeout,
  );
});

const prepareLintProject = Effect.fn(function* (platform: Platform) {
  const { directory, fs, path, workspace } = yield* starterWorkspace("create-effront-lint-");
  const project = yield* generateProject(path.join(directory, platform), platform);
  // Reuse installed platform dependencies. The private Git root owns the ignore scope.
  const installedModules = path.join(workspace, "examples", platform, "node_modules");
  yield* fs.symlink(installedModules, path.join(project, "node_modules"));
  yield* commandOutput("git", ["init", "--quiet"], project);
  const lint = commandOutput(
    "vp",
    ["lint", "--format", "json", "--report-unused-disable-directives-severity", "error"],
    project,
  );
  return { fs, lint, path, project };
});

describe("generated application preset", () => {
  live.each(platforms)(
    "lints the generated %s project with application tracing",
    (platform) =>
      Effect.gen(function* () {
        const { fs, lint, path, project } = yield* prepareLintProject(platform);
        const clean = yield* lint;
        const count = platform === "cloudflare" ? standaloneFileCount : otherFileCount;
        expect(yield* decodeJson(clean)).toMatchObject({ diagnostics: [], number_of_files: count });
        yield* fs.writeFileString(path.join(project, "src", "tracing-probe.ts"), tracingProbe);
        const error = yield* Effect.flip(lint);
        expect(error).toHaveProperty("code", failedLint);
        expect(Predicate.hasProperty(error, "stdout") && error.stdout).toContain(
          "rules(effect-tracing)",
        );
      }).pipe(Effect.provide(NodeServices.layer)),
    integrationTimeout,
  );
});
