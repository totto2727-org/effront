import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vite-plus/test";

const runFile = promisify(execFile);
const subprocessTimeout = 15_000;
const testTimeout = 20_000;
const cwd = fileURLToPath(new URL("../../", import.meta.url));
const entries = [
  {
    specifier: "@effront/alchemy/cloudflare",
    deployment: "deployment.js",
    runtime: "runtime.js",
    construct:
      "makeApplicationHttpEffect(() => { throw new Error('Loader ran during construction'); })",
  },
  {
    specifier: "@effront/alchemy/cloudflare/application",
    deployment: "application.js",
    runtime: "application-runtime.js",
    construct: "makeApplicationHttpEffect()",
  },
];

describe("published Alchemy execution graph entries", () => {
  test.each(entries)(
    "constructs $specifier without resolving core runtime modules",
    async (entry) => {
      const { stdout } = await runFile(
        process.execPath,
        [
          "--input-type=module",
          "--eval",
          `
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
        `,
        ],
        { cwd, encoding: "utf8", timeout: subprocessTimeout },
      );
      expect(stdout.trim()).toBe(
        new URL(`../../dist/cloudflare/${entry.deployment}`, import.meta.url).href,
      );
    },
    testTimeout,
  );

  test.each(entries)(
    "selects the static RSC entry for $specifier under react-server",
    async (entry) => {
      const { stdout } = await runFile(
        process.execPath,
        [
          "--conditions=react-server",
          "--input-type=module",
          "--eval",
          `console.log(import.meta.resolve(${JSON.stringify(entry.specifier)}));`,
        ],
        { cwd, encoding: "utf8", timeout: subprocessTimeout },
      );
      expect(stdout.trim()).toBe(
        new URL(`../../dist/cloudflare/${entry.runtime}`, import.meta.url).href,
      );
    },
    testTimeout,
  );
});
