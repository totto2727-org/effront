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
        import { makeApplicationHttpEffect ${configured ? "" : ", applicationHttpEffect"} } from ${JSON.stringify(entry)};
        import type { ApplicationDefinition } from "@effront/core";
        import type { HttpApplicationEffect } from "@effront/core/http";
        import type { CloudflareEnvironment } from "alchemy/Cloudflare";
        import type { Request, Worker, WorkerEnvironment, WorkerExecutionContext } from "alchemy/Cloudflare/Workers";
        import { Context, Effect } from "effect";
        class ControlApi extends Context.Service<ControlApi, { readonly read: () => string }>()("consumer/ControlApi") {}
        type Failure = { readonly _tag: "ApplicationFailure" };
        type Hosts = CloudflareEnvironment | Request | Worker | WorkerEnvironment | WorkerExecutionContext;
        type Requirements = ControlApi | Hosts;
        type Definition = ApplicationDefinition<ControlApi, Failure, Requirements>;
        declare const load: () => Promise<Definition>;
        const construction = ${configured ? "makeApplicationHttpEffect<Definition>()" : "makeApplicationHttpEffect(load)"};
        type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
        type IsAny<T> = 0 extends (1 & T) ? true : false;
        type Assert<T extends true> = T;
        export type Captured = Assert<Equal<Effect.Services<typeof construction>, ControlApi>>;
        export type CapturedNotAny = Assert<Equal<IsAny<Effect.Services<typeof construction>>, false>>;
        export type ConstructionError = Assert<Equal<Effect.Error<typeof construction>, never>>;
        type Handler = Effect.Success<typeof construction>;
        type Native = HttpApplicationEffect<Failure, Requirements>;
        export type Live = Assert<Equal<Effect.Services<Handler>, Exclude<Effect.Services<Native>, ControlApi>>>;
        export type LiveNotAny = Assert<Equal<IsAny<Effect.Services<Handler>>, false>>;
        export type Error = Assert<Equal<Effect.Error<Handler>, Effect.Error<Native>>>;
        export type ErrorNotAny = Assert<Equal<IsAny<Effect.Error<Handler>>, false>>;
        export type Success = Assert<Equal<Effect.Success<Handler>, Effect.Success<Native>>>;
        type PureDefinition = ApplicationDefinition<ControlApi, never, ControlApi>;
        declare const loadPure: () => Promise<PureDefinition>;
        const pureConstruction = ${configured ? "makeApplicationHttpEffect<PureDefinition>()" : "makeApplicationHttpEffect(loadPure)"};
        export type PureCaptured = Assert<Equal<Effect.Services<typeof pureConstruction>, ControlApi>>;
        Effect.runPromise(Effect.provideService(pureConstruction, ControlApi, { read: () => "ok" }));
        // @ts-expect-error A consumer must provide the captured application capability.
        Effect.runPromise(construction);
        Effect.runPromise(Effect.provideService(construction, ControlApi, { read: () => "ok" }));
        ${
          configured
            ? ""
            : `
          const uncaptured = applicationHttpEffect(load);
          export type Uncaptured = Assert<Equal<Effect.Services<typeof uncaptured>, Effect.Services<Native>>>;
          const captured = applicationHttpEffect(load, { context: Context.make(ControlApi, { read: () => "ok" }) });
          export type Provided = Assert<Equal<Effect.Services<typeof captured>, Effect.Services<Handler>>>;
          declare const hosts: Context.Context<Hosts>;
          const hostContext = applicationHttpEffect(load, { context: hosts });
          export type HostNotCaptured = Assert<Equal<Effect.Services<typeof hostContext>, Effect.Services<Native>>>;
        `
        }
      `,
      );
    }

    // Check only module references emitted by this package, not unrelated third-party declarations.
    // skipLibCheck alone would silently turn an unresolvable declaration import into an error-any.
    const specifiers = new Set<string>();
    for (const file of readdirSync(join(packed, "dist/cloudflare"))) {
      if (!file.endsWith(".d.ts")) continue;
      const declaration = readFileSync(join(packed, "dist/cloudflare", file), "utf8");
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
    expect(probes.length).toBeGreaterThan(0);
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
