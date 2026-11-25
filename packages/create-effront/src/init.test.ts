import { NodeServices } from "@effect/platform-node";
import { live } from "@effect/vitest";
import { Array, Effect, Schema } from "effect";
import { describe, expect } from "vitest";

import {
  decodeJson,
  expectPnpmConfiguration,
  generateProject,
  readProjectManifest,
  sourceWorkspace,
  starterWorkspace,
} from "./init-project.fixture.ts";
import { platforms } from "./init.ts";
import type { Platform } from "./init.ts";

const decodeOwner = Schema.decodeEffect(
  Schema.fromJsonString(Schema.Struct({ version: Schema.String })),
);
const decodeWorkspace = Schema.decodeEffect(
  Schema.fromJsonString(Schema.Struct({ packageManager: Schema.String })),
);
const metadata = Effect.gen(function* () {
  const { fs, owner, path, workspace } = yield* sourceWorkspace;
  const ownerManifest = yield* fs.readFileString(path.join(owner, "package.json"));
  const workspaceManifest = yield* fs.readFileString(path.join(workspace, "package.json"));
  const { version } = yield* decodeOwner(ownerManifest);
  const { packageManager } = yield* decodeWorkspace(workspaceManifest);
  return { packageManager, version };
});

const generate = Effect.fn(function* (platform: Platform, name: string = platform) {
  const source = yield* starterWorkspace("create-effront-test-");
  const directory = source.path.join(source.directory, name);
  yield* generateProject(directory, platform);
  return { ...source, directory };
});

const scripts = {
  "alchemy-cloudflare": { dev: "alchemy dev" },
  bun: { start: "bun dist/rsc/server.js" },
  cloudflare: { deploy: "wrangler deploy" },
  node: { start: "node dist/rsc/server.js" },
} satisfies Record<Platform, object>;

const allowedVersions = (
  manifest: Effect.Success<ReturnType<typeof readProjectManifest>>,
  releasedVersion: string,
): boolean => {
  const dependencies = Object.entries({ ...manifest.dependencies, ...manifest.devDependencies });
  return Array.every(dependencies, ([name, version]) => {
    if (name.startsWith("@effront/")) {
      return version === `^${releasedVersion}`;
    }
    if (name === "effect" || name.startsWith("@effect/")) {
      return version === "^4.0.2";
    }
    return version.startsWith("^");
  });
};

describe("shared starter application", () => {
  live.each(platforms)("creates a %s manifest with the shared package policy", (platform) =>
    Effect.gen(function* () {
      const { directory, fs } = yield* generate(platform, "My App");
      const { packageManager, version } = yield* metadata;
      const manifest = yield* readProjectManifest(directory);
      expect(manifest).toMatchObject({
        devDependencies: {
          "@totto2727/gitignore-patterns": "^0.1.0",
          "@totto2727/oxlint": "^0.2.0",
          "vite-plus": "^1.1.0",
        },
        name: "my-app",
        packageManager,
        scripts: scripts[platform],
      });
      expect(manifest.scripts).toStrictEqual(scripts[platform]);
      expect(allowedVersions(manifest, version)).toBe(true);
      expect(JSON.stringify(manifest)).not.toMatch(
        /workspace:|catalog:|"overrides"|"trustedDependencies"/u,
      );
      expect(yield* fs.readDirectory(directory)).not.toContain("bunfig.toml");
      yield* expectPnpmConfiguration(directory, platform);
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  live.each(platforms)("reuses the shared application and lint wiring on %s", (platform) =>
    Effect.gen(function* () {
      const { directory, fs, path, workspace } = yield* generate(platform);
      const projectSource = yield* fs.readFileString(path.join(directory, "src/entry.effront.tsx"));
      const examples = yield* Effect.forEach(platforms, (example) =>
        fs.readFileString(path.join(workspace, "examples", example, "src/entry.effront.tsx")),
      );
      expect(examples).toStrictEqual(platforms.map(() => projectSource));
      expect(yield* fs.readDirectory(path.join(directory, "src"))).toContain("entry.effront.tsx");
      expect(yield* fs.readFileString(path.join(directory, ".gitignore"))).toContain(
        "node_modules/",
      );
      const config = yield* fs.readFileString(path.join(directory, "vite.config.ts"));
      const required = [
        'import { generateIgnorePatterns } from "@totto2727/gitignore-patterns"',
        'await generateIgnorePatterns(new URL(".", import.meta.url))',
        "fmt: { ignorePatterns }",
        "lint: createLintConfig(ignorePatterns)",
      ];
      expect(required.filter((item) => !config.includes(item))).toStrictEqual([]);
    }).pipe(Effect.provide(NodeServices.layer)),
  );
});

const hostEntries = {
  "alchemy-cloudflare": [],
  bun: ["src/entry.rsc.ts", "src/entry.server.ts"],
  cloudflare: ["src/entry.workers.ts"],
  node: ["src/entry.rsc.ts", "src/entry.server.ts"],
} satisfies Record<Platform, string[]>;

const workspaceConfig = (source: string): string =>
  source
    .replace('import { generateIgnorePatterns } from "@totto2727/gitignore-patterns";\n', "")
    .replace('import { createLintConfig } from "./lint.config.ts";\n', "")
    .replace(
      '\nconst ignorePatterns = await generateIgnorePatterns(new URL(".", import.meta.url));\n',
      "",
    )
    .replace("  fmt: { ignorePatterns },\n  lint: createLintConfig(ignorePatterns),\n", "");

describe("generated host parity", () => {
  live.each(platforms)(
    "keeps generated %s host entries aligned with the runnable example",
    (platform) =>
      Effect.gen(function* () {
        const { directory, fs, path, workspace } = yield* generate(platform);
        const example = path.join(workspace, "examples", platform);
        const configName = "vite.config.ts";
        const generatedConfig = yield* fs.readFileString(path.join(directory, configName));
        const exampleConfig = yield* fs.readFileString(path.join(example, configName));
        expect(workspaceConfig(generatedConfig)).toBe(exampleConfig);
        const files = hostEntries[platform];
        const generated = yield* Effect.forEach(files, (file) =>
          fs.readFileString(path.join(directory, file)),
        );
        const reference = yield* Effect.forEach(files, (file) =>
          fs.readFileString(path.join(example, file)),
        );
        expect(generated).toStrictEqual(reference);
      }).pipe(Effect.provide(NodeServices.layer)),
  );
});

describe("standalone Worker starter", () => {
  live("uses Wrangler without Alchemy or a native server", () =>
    Effect.gen(function* () {
      const { directory, fs, path } = yield* generate("cloudflare");
      const manifest = yield* readProjectManifest(directory);
      const { version } = yield* metadata;
      expect(manifest).toMatchObject({
        dependencies: { "@effront/cloudflare": `^${version}` },
        devDependencies: { wrangler: "^4.148.0" },
        scripts: { deploy: "wrangler deploy" },
      });
      const forbidden = ["@effront/alchemy", "alchemy", "@effront/server"];
      const dependencies = Object.keys(manifest.dependencies ?? {});
      expect(forbidden.filter((name) => dependencies.includes(name))).toStrictEqual([]);
      expect(yield* fs.readDirectory(directory)).not.toContain("alchemy.run.ts");
      expect(yield* fs.readDirectory(path.join(directory, "src"))).not.toContain("entry.server.ts");
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  live("configures native Worker rendering without generated bindings", () =>
    Effect.gen(function* () {
      const { directory, fs, path } = yield* generate("cloudflare");
      const worker = yield* fs.readFileString(path.join(directory, "src/entry.workers.ts"));
      const config = yield* fs.readFileString(path.join(directory, "vite.config.ts"));
      const wrangler = yield* fs
        .readFileString(path.join(directory, "wrangler.json"))
        .pipe(Effect.flatMap(decodeJson));
      expect(worker).toContain("createFetchHandler(application)");
      expect(config).toContain("effrontCloudflare()");
      expect(config).not.toContain("server:");
      expect(wrangler).toMatchObject({ main: "src/entry.workers.ts", name: "cloudflare" });
      const separateBindings = Object.keys(wrangler).filter(
        (name) => name === "vars" || name === "assets",
      );
      expect(separateBindings).toStrictEqual([]);
    }).pipe(Effect.provide(NodeServices.layer)),
  );
});

describe("starter for an Alchemy Worker", () => {
  live("uses Alchemy without Wrangler or a native server", () =>
    Effect.gen(function* () {
      const { directory, fs, path } = yield* generate("alchemy-cloudflare");
      const manifest = yield* readProjectManifest(directory);
      const { version } = yield* metadata;
      expect(manifest.dependencies).toHaveProperty("@effront/alchemy", `^${version}`);
      expect(manifest.dependencies).not.toHaveProperty("@effront/cloudflare");
      expect(manifest.dependencies).not.toHaveProperty("@effront/server");
      expect(yield* fs.readDirectory(directory)).not.toContain("wrangler.json");
      expect(yield* fs.readDirectory(path.join(directory, "src"))).not.toContain("entry.server.ts");
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  live("renders the Worker through the Effront Alchemy runtime", () =>
    Effect.gen(function* () {
      const { directory, fs, path } = yield* generate("alchemy-cloudflare");
      const worker = yield* fs.readFileString(path.join(directory, "src/entry.workers.ts"));
      const config = yield* fs.readFileString(path.join(directory, "vite.config.ts"));
      const runner = yield* fs.readFileString(path.join(directory, "alchemy.run.ts"));
      expect(worker).toContain("makeApplicationHttpEffect");
      expect(config).toContain("effrontAlchemy()");
      expect(config).not.toContain("server:");
      expect(runner).toContain('"alchemy-cloudflare"');
      expect(worker).not.toContain("dev: { port:");
    }).pipe(Effect.provide(NodeServices.layer)),
  );
});

describe("native development servers", () => {
  live.each(["node", "bun"] as const)(
    "uses Vite defaults and optional host environment settings for %s",
    (platform) =>
      Effect.gen(function* () {
        const { directory, fs, path } = yield* generate(platform);
        const config = yield* fs.readFileString(path.join(directory, "vite.config.ts"));
        const server = yield* fs.readFileString(path.join(directory, "src/entry.server.ts"));
        expect(config).not.toContain("server:");
        const environmentOverrides = [
          'PORT: port = ""',
          'HOST: hostname = ""',
          "...(String.isNonEmpty(port) ? { port: Number(port) } : {})",
          "...(String.isNonEmpty(hostname) ? { hostname } : {})",
        ];
        expect(environmentOverrides.filter((item) => !server.includes(item))).toStrictEqual([]);
        expect(server).not.toContain("port: undefined");
        expect(server).not.toMatch(/1340|1343|127\.0\.0\.1/u);
      }).pipe(Effect.provide(NodeServices.layer)),
  );
});
