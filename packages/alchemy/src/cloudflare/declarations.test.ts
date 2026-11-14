import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, it } from "vite-plus/test";

const repository = fileURLToPath(new URL("../../../../", import.meta.url));
const owner = join(repository, "packages/alchemy");
const compiler = join(
  dirname(fileURLToPath(import.meta.resolve("typescript/package.json"))),
  "bin/tsc",
);

it("packed default and react-server declarations preserve application capabilities through public Alchemy exports", () => {
  mkdirSync(join(repository, "tmp"), { recursive: true });
  const workspace = mkdtempSync(join(repository, "tmp/alchemy-declarations-"));
  try {
    execFileSync("pnpm", ["pack", "--pack-destination", workspace], {
      cwd: owner,
      encoding: "utf8",
    });
    const archive = readdirSync(workspace).find((file) => file.endsWith(".tgz"));
    if (!archive) throw new Error("pnpm pack did not produce a package archive");
    const contents = execFileSync("tar", ["-tzf", join(workspace, archive)], { encoding: "utf8" });
    expect(contents).not.toMatch(/\.(?:test|e2e)\.[cm]?[jt]sx?$/m);
    execFileSync("tar", ["-xzf", join(workspace, archive), "-C", workspace]);
    const packed = join(workspace, "package");
    symlinkSync(join(owner, "node_modules"), join(packed, "node_modules"), "dir");
    mkdirSync(join(workspace, "node_modules/@effront"), { recursive: true });
    symlinkSync(packed, join(workspace, "node_modules/@effront/alchemy"), "dir");
    for (const dependency of ["effect", "@effront/core", "alchemy"]) {
      symlinkSync(
        join(owner, "node_modules", dependency),
        join(workspace, "node_modules", dependency),
        "dir",
      );
    }

    const entries = [
      ["@effront/alchemy/cloudflare", false],
      ["@effront/alchemy/cloudflare/application", true],
      ["./package/dist/cloudflare/runtime.js", false],
      ["./package/dist/cloudflare/application-runtime.js", true],
    ] as const;
    for (const [index, [entry, configured]] of entries.entries()) {
      writeFileSync(
        join(workspace, `consumer-${index}.ts`),
        `
        import { applicationHttpEffect } from ${JSON.stringify(entry)};
        // @ts-expect-error The construction helper is no longer exported.
        import { makeApplicationHttpEffect } from ${JSON.stringify(entry)};
        import type { ApplicationDefinition } from "@effront/core";
        import type { HttpApplicationEffect } from "@effront/core/http";
        import type { CloudflareEnvironment } from "alchemy/Cloudflare";
        import type { Request, Worker, WorkerEnvironment, WorkerExecutionContext } from "alchemy/Cloudflare/Workers";
        import { Context, Effect } from "effect";
        import { HttpServerRequest } from "effect/http";
        class ControlApi extends Context.Service<ControlApi, { readonly read: () => string }>()("consumer/ControlApi") {}
        type Failure = { readonly _tag: "ApplicationFailure" };
        type Hosts = CloudflareEnvironment | Request | Worker | WorkerEnvironment | WorkerExecutionContext;
        type Requirements = ControlApi | Hosts;
        type Definition = ApplicationDefinition<ControlApi, Failure, Requirements>;
        declare const load: () => Promise<Definition>;
        const handler = ${configured ? "applicationHttpEffect<Definition>()" : "applicationHttpEffect(load)"};
        type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
        type IsAny<T> = 0 extends (1 & T) ? true : false;
        type Assert<T extends true> = T;
        type Handler = typeof handler;
        type Native = HttpApplicationEffect<Failure, Requirements>;
        export type Live = Assert<Equal<Effect.Services<Handler>, Effect.Services<Native>>>;
        export type LiveNotAny = Assert<Equal<IsAny<Effect.Services<Handler>>, false>>;
        export type Error = Assert<Equal<Effect.Error<Handler>, Effect.Error<Native>>>;
        export type ErrorNotAny = Assert<Equal<IsAny<Effect.Error<Handler>>, false>>;
        export type Success = Assert<Equal<Effect.Success<Handler>, Effect.Success<Native>>>;
        type PureDefinition = ApplicationDefinition<ControlApi, never, ControlApi>;
        declare const loadPure: () => Promise<PureDefinition>;
        const pureHandler = ${configured ? "applicationHttpEffect<PureDefinition>()" : "applicationHttpEffect(loadPure)"};
        export type PureRequirements = Assert<Equal<Effect.Services<typeof pureHandler>, Effect.Services<HttpApplicationEffect<never, ControlApi>>>>;
        const supplied = pureHandler.pipe(Effect.provideService(ControlApi, { read: () => "ok" }));
        export type HostRequirements = Assert<Equal<Effect.Services<typeof supplied>, Effect.Services<HttpApplicationEffect<never, never>>>>;
        Effect.runPromise(Effect.scoped(supplied).pipe(
          Effect.provideService(HttpServerRequest.HttpServerRequest, HttpServerRequest.fromWeb(new globalThis.Request("https://example.test/"))),
        ));
        // @ts-expect-error A consumer must provide application and host capabilities.
        Effect.runPromise(handler);
        // @ts-expect-error Providing application capabilities does not erase host requirements.
        Effect.runPromise(Effect.provideService(handler, ControlApi, { read: () => "ok" }));
        ${
          configured
            ? `
          // @ts-expect-error A configured entry must be an application definition.
          applicationHttpEffect<string>();
          // @ts-expect-error Missing application type cannot erase unknown requirements.
          Effect.runPromise(applicationHttpEffect());
          `
            : `
          // @ts-expect-error Context capture options are not part of the direct handler API.
          applicationHttpEffect(load, { context: Context.make(ControlApi, { read: () => "ok" }) });
          // @ts-expect-error The explicit handler requires a loader.
          applicationHttpEffect();
        `
        }
      `,
      );
    }

    // Check only module references emitted by this package, not unrelated third-party declarations.
    // skipLibCheck alone would silently turn an unresolvable declaration import into an error-any.
    const declarations: string[] = [];
    const specifiers = new Set<string>();
    for (const file of readdirSync(join(packed, "dist/cloudflare"))) {
      if (!file.endsWith(".d.ts")) continue;
      const declaration = readFileSync(join(packed, "dist/cloudflare", file), "utf8");
      declarations.push(declaration);
      const references = [
        ...declaration.matchAll(/(?:from\s*|import\()(["'])(alchemy(?:\/[^"']*)?)\1/g),
      ];
      for (const match of references) {
        if (match[2]) specifiers.add(match[2]);
      }
    }
    const probes = [...specifiers].map(
      (specifier, index) => `import * as module${index} from ${JSON.stringify(specifier)};`,
    );
    expect(declarations.join("\n")).toContain("@effront/core/http");
    expect(declarations.join("\n")).toContain("HttpApplicationEffect");
    expect([...specifiers]).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/alchemy\/(?:src|lib|dist)\//)]),
    );
    writeFileSync(join(workspace, "resolution.ts"), probes.join("\n"));
    writeFileSync(
      join(workspace, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          exactOptionalPropertyTypes: true,
          noEmit: true,
          skipLibCheck: true,
          target: "ESNext",
          module: "ESNext",
          moduleResolution: "Bundler",
          types: [],
          lib: ["ESNext", "DOM", "DOM.Iterable"],
        },
        include: ["consumer-*.ts", "resolution.ts"],
      }),
    );
    const result = spawnSync(
      process.execPath,
      [compiler, "--project", join(workspace, "tsconfig.json")],
      {
        encoding: "utf8",
        timeout: 60_000,
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.status, result.stdout + result.stderr).toBe(0);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}, 90_000);
