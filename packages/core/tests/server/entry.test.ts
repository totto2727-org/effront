import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

const cwd = fileURLToPath(new URL("../../", import.meta.url));

describe("published core execution graph entries", () => {
  it("loads HTTP and Workers entries with a CSS loader but without the RSC protocol graph", () => {
    const hooks = `
      import { registerHooks } from "node:module";
      registerHooks({
        resolve(specifier, context, next) {
          if (specifier.startsWith("@vitejs/plugin-rsc/rsc/") || specifier.startsWith("virtual:")) {
            throw new Error("Ordinary HTTP imports resolved the RSC protocol graph: " + specifier);
          }
          return next(specifier, context);
        },
        load(url, context, next) {
          // Hosts already process core's client CSS. No RSC or JavaScript module is mocked.
          if (url.endsWith(".css")) return { format: "module", source: "", shortCircuit: true };
          return next(url, context);
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
          import assert from "node:assert/strict";
          import { makeHttpEffect, toHttpEffect } from "@effront/core/http";
          import { createFetchHandler, getWorkersEnv } from "@effront/core/workers";
          import { renderToReadableStream } from "#rsc-server";
          import { Effect } from "effect";
          if (typeof makeHttpEffect !== "function" || typeof toHttpEffect !== "function" || typeof createFetchHandler !== "function") {
            throw new Error("Missing public HTTP API");
          }
          if (!Effect.isEffect(getWorkersEnv())) throw new Error("Expected a native context accessor Effect");
          assert.throws(() => renderToReadableStream(null), {
            name: "TypeError",
            message: /require the react-server compilation graph/,
          });
          console.log(import.meta.resolve("#rsc-server"));
        `,
      ],
      { cwd, encoding: "utf8" },
    );
    expect(output.trim()).toBe(
      new URL("../../dist/server/unsupported-rsc.js", import.meta.url).href,
    );
  });

  it("selects the native RSC protocol module under react-server", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--conditions=react-server",
        "--input-type=module",
        "--eval",
        `
          if (import.meta.resolve("#rsc-server") !== import.meta.resolve("@vitejs/plugin-rsc/rsc/server")) {
            throw new Error("The RSC graph did not select the native protocol module");
          }
          console.log("react-server");
        `,
      ],
      { cwd, encoding: "utf8" },
    );
    expect(output.trim()).toBe("react-server");
  });
});
