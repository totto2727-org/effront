import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

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
  it.each(entries)("constructs $specifier without resolving core runtime modules", (entry) => {
    const hooks = `
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
    `;
    const output = execFileSync(
      process.execPath,
      [
        "--import",
        `data:text/javascript,${encodeURIComponent(hooks)}`,
        "--input-type=module",
        "--eval",
        `
          import { makeApplicationHttpEffect } from ${JSON.stringify(entry.specifier)};
          import { Effect } from "effect";
          const handler = await Effect.runPromise(${entry.construct});
          if (!Effect.isEffect(handler)) throw new Error("Expected a native handler Effect");
          console.log(import.meta.resolve(${JSON.stringify(entry.specifier)}));
        `,
      ],
      { cwd, encoding: "utf8" },
    );
    expect(output.trim()).toBe(
      new URL(`../../dist/cloudflare/${entry.deployment}`, import.meta.url).href,
    );
  });

  it.each(entries)("selects the static RSC entry for $specifier under react-server", (entry) => {
    const output = execFileSync(
      process.execPath,
      [
        "--conditions=react-server",
        "--input-type=module",
        "--eval",
        `console.log(import.meta.resolve(${JSON.stringify(entry.specifier)}));`,
      ],
      { cwd, encoding: "utf8" },
    );
    expect(output.trim()).toBe(
      new URL(`../../dist/cloudflare/${entry.runtime}`, import.meta.url).href,
    );
  });
});
