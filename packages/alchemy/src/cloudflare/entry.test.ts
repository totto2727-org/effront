import { NodeServices } from "@effect/platform-node";
import { live } from "@effect/vitest";
import { Data, Effect, Path, Stream } from "effect";
import { ChildProcess } from "effect/process";
import { describe, expect } from "vite-plus/test";

const testTimeout = 20_000;
const entries = [
  {
    construct:
      "makeApplicationHttpEffect(() => { throw new Error('Loader ran during construction'); })",
    deployment: "deployment.js",
    runtime: "runtime.js",
    specifier: "@effront/alchemy/cloudflare",
  },
  {
    construct: "makeApplicationHttpEffect()",
    deployment: "application.js",
    runtime: "application-runtime.js",
    specifier: "@effront/alchemy/cloudflare/application",
  },
];
type Entry = (typeof entries)[number];

class EntryProcessFailure extends Data.TaggedError("EntryProcessFailure")<{
  code: number;
  stderr: string;
}> {}

const evaluate = Effect.fn(
  function* (program: string, conditions: string[] = []) {
    const path = yield* Path.Path;
    const cwd = yield* path.fromFileUrl(new URL("../../", import.meta.url));
    const command = ChildProcess.make(
      process.execPath,
      [...conditions, "--input-type=module", "--eval", program],
      { cwd },
    );
    const { exitCode, stderr, stdout } = yield* command;
    const output = yield* Effect.all(
      {
        code: exitCode,
        stderr: Stream.mkString(Stream.decodeText(stderr)),
        stdout: Stream.mkString(Stream.decodeText(stdout)),
      },
      { concurrency: "unbounded" },
    );
    if (output.code !== 0) {
      return yield* new EntryProcessFailure({ code: output.code, stderr: output.stderr });
    }
    return output.stdout.trim();
  },
  Effect.scoped,
  Effect.timeout("15 seconds"),
  Effect.provide(NodeServices.layer),
);

const deploymentProgram = (entry: Entry): string => `
  import { registerHooks } from "node:module";
  registerHooks({
    resolve(specifier, context, next) {
      if (specifier === "@effront/core" || specifier.startsWith("@effront/core/")) {
        throw new Error("Deployment resolved an RSC runtime module: " + specifier);
      }
      if (${entry.specifier === "@effront/alchemy/cloudflare"} && specifier.includes("application-loader")) {
        throw new Error("Explicit-loader entry resolved the configured application loader");
      }
      return next(specifier, context);
    }
  });
  const { makeApplicationHttpEffect } = await import(${JSON.stringify(entry.specifier)});
  const { Effect } = await import("effect");
  const handler = await Effect.runPromise(${entry.construct});
  if (!Effect.isEffect(handler)) throw new Error("Expected a native handler Effect");
  console.log(import.meta.resolve(${JSON.stringify(entry.specifier)}));
`;

describe("published Alchemy execution graph entries", () => {
  live.each(entries)(
    "constructs $specifier without resolving core runtime modules",
    (entry) =>
      Effect.gen(function* () {
        const resolved = yield* evaluate(deploymentProgram(entry));
        const expected = new URL(`../../dist/cloudflare/${entry.deployment}`, import.meta.url);
        expect(resolved).toBe(expected.href);
      }),
    testTimeout,
  );

  live.each(entries)(
    "selects the static RSC entry for $specifier under react-server",
    (entry) =>
      Effect.gen(function* () {
        const resolve = `console.log(import.meta.resolve(${JSON.stringify(entry.specifier)}));`;
        const resolved = yield* evaluate(resolve, ["--conditions=react-server"]);
        const expected = new URL(`../../dist/cloudflare/${entry.runtime}`, import.meta.url);
        expect(resolved).toBe(expected.href);
      }),
    testTimeout,
  );
});
