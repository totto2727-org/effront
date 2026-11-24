import { NodeServices } from "@effect/platform-node";
import { live } from "@effect/vitest";
import { Console, Effect, FileSystem, Path, Predicate, Result, Schema } from "effect";
import { Command } from "effect/cli";
import { describe, expect, vi } from "vitest";

import { command } from "./cli.ts";
import { createProject, platforms, projectName } from "./init.ts";
import type { Platform } from "./init.ts";

const decodeVersion = Schema.decodeEffect(
  Schema.fromJsonString(Schema.Struct({ version: Schema.String })),
);
const decodeName = Schema.decodeEffect(
  Schema.fromJsonString(Schema.Struct({ name: Schema.String })),
);

const testDirectory = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "create-effront-test-" });
  return { directory, fs, path };
});

const cliVersion = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const manifest = yield* path.fromFileUrl(new URL("../package.json", import.meta.url));
  const source = yield* fs.readFileString(manifest);
  return yield* decodeVersion(source);
});

const runCli = Effect.fn(function* (args: string[]) {
  const { version } = yield* cliVersion;
  const base = yield* Console.Console;
  const log = vi.fn<Console.Console["log"]>();
  const output = new Proxy(base, {
    get: (target, method, receiver): unknown =>
      method === "log" ? log : Reflect.get(target, method, receiver),
  });
  const run = Command.runWith(command, { version });
  yield* run(args).pipe(Effect.provideService(Console.Console, output));
  return log;
});

const initialize = Effect.fn(function* (directory: string, platform: Platform) {
  return yield* Effect.tryPromise(async () => createProject(directory, platform));
});

describe("command options and help", () => {
  live.each(platforms)("accepts the %s flag forwarded by vp create", (platform) =>
    Effect.gen(function* () {
      const { directory, fs, path } = yield* testDirectory;
      const name = `forwarded-${platform}`;
      const project = path.join(directory, name);
      yield* runCli([project, "--platform", platform]);
      const manifest = yield* fs.readFileString(path.join(project, "package.json"));
      expect(yield* decodeName(manifest)).toStrictEqual({ name });
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  live("describes supported platforms in framework-generated help", () =>
    Effect.gen(function* () {
      const output = yield* runCli(["--help"]);
      expect(output).toHaveBeenCalledWith(expect.stringContaining("--platform"));
      expect(output).toHaveBeenCalledWith(expect.stringContaining("alchemy-cloudflare"));
    }).pipe(Effect.provide(NodeServices.layer)),
  );
});

describe("destination validation", () => {
  live("refuses to overwrite an existing project", () =>
    Effect.gen(function* () {
      const { directory, fs, path } = yield* testDirectory;
      const preserved = path.join(directory, "keep.txt");
      yield* fs.writeFileString(preserved, "preserve me");
      const error = yield* Effect.flip(initialize(directory, "node"));
      const { cause } = error;
      const message = Predicate.hasProperty(cause, "message") ? cause.message : undefined;
      expect(message).toContain("not empty");
      expect(yield* fs.readFileString(preserved)).toBe("preserve me");
      expect(yield* fs.readDirectory(directory)).toStrictEqual(["keep.txt"]);
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  live("validates the normalized project name before touching the target", () =>
    Effect.gen(function* () {
      const { directory, fs, path } = yield* testDirectory;
      expect(projectName(path.join(directory, "My 🧪 App"))).toBe("my-app");
      const error = yield* Effect.flip(initialize(path.join(directory, "🧪"), "node"));
      expect(error.cause).toMatchObject({
        message: "Project directory must contain letters or numbers.",
      });
      expect(yield* fs.readDirectory(directory)).toStrictEqual([]);
    }).pipe(Effect.provide(NodeServices.layer)),
  );
});

describe("invalid command syntax", () => {
  live.each([
    { arguments: ["--platform", "workers"], case: "unsupported platform" },
    { arguments: ["--unknown"], case: "unknown option" },
    { arguments: ["--platform="], case: "empty platform" },
    { arguments: ["extra", "--platform", "node"], case: "surplus operand" },
  ])("rejects the $case without creating a project", ({ arguments: options }) =>
    Effect.gen(function* () {
      const { directory, fs, path } = yield* testDirectory;
      const project = path.join(directory, "invalid");
      const result = yield* Effect.result(runCli([project, ...options]));
      expect(Result.isFailure(result)).toBe(true);
      expect(yield* fs.exists(project)).toBe(false);
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  live("rejects missing options without a terminal", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(runCli([]));
      expect(failure.message).toBe("Specify a directory and --platform in non-interactive mode.");
    }).pipe(Effect.provide(NodeServices.layer)),
  );
});

describe("host startup instructions", () => {
  live("creating a standalone Worker recommends ordinary Vite+ commands", () =>
    Effect.gen(function* () {
      const { directory, fs, path } = yield* testDirectory;
      const project = path.join(directory, "my-app");
      const output = yield* runCli([project, "--platform", "cloudflare"]);
      expect(output).toHaveBeenCalledWith(
        expect.stringContaining(`Next: cd ${project} && vp install && vp dev`),
      );
      const manifest = yield* fs.readFileString(path.join(project, "wrangler.json"));
      expect(yield* decodeName(manifest)).toStrictEqual({ name: "my-app" });
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  live("creating an Alchemy Worker recommends Alchemy orchestration", () =>
    Effect.gen(function* () {
      const { directory, path } = yield* testDirectory;
      const project = path.join(directory, "alchemy-app");
      const output = yield* runCli([project, "--platform", "alchemy-cloudflare"]);
      expect(output).toHaveBeenCalledWith(
        expect.stringContaining(`Next: cd ${project} && vp install && vp run dev`),
      );
    }).pipe(Effect.provide(NodeServices.layer)),
  );
});
