import { NodeServices } from "@effect/platform-node";
import { live } from "@effect/vitest";
import { Data, Effect, FileSystem, Path, Predicate, Stream } from "effect";
import { ChildProcess } from "effect/process";
import { assert, describe } from "vite-plus/test";

const testTimeout = 90_000;
const archiveTimeout = "15 seconds";
const compilerTimeout = "60 seconds";
const dependencies = ["effect", "@effront/core", "alchemy"];
const entries = [
  { configured: false, entry: "@effront/alchemy/cloudflare" },
  { configured: true, entry: "@effront/alchemy/cloudflare/application" },
  { configured: false, entry: "./package/dist/cloudflare/runtime.js" },
  { configured: true, entry: "./package/dist/cloudflare/application-runtime.js" },
];
type Consumer = (typeof entries)[number];

class ArchiveProcessFailure extends Data.TaggedError("ArchiveProcessFailure")<{
  code: number;
  executable: string;
  stderr: string;
}> {}

const run = Effect.fnUntraced(function* (executable: string, args: string[], cwd: string) {
  const { exitCode, stderr, stdout } = yield* ChildProcess.make(executable, args, { cwd });
  const output = yield* Effect.all(
    {
      code: exitCode,
      stderr: stderr.pipe(Stream.decodeText, Stream.mkString),
      stdout: stdout.pipe(Stream.decodeText, Stream.mkString),
    },
    { concurrency: "unbounded" },
  );
  if (output.code !== 0) {
    return yield* new ArchiveProcessFailure({
      code: output.code,
      executable,
      stderr: output.stderr,
    });
  }
  return output.stdout;
}, Effect.scoped);

const unpack = Effect.fnUntraced(function* (owner: string, workspace: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* run("pnpm", ["pack", "--pack-destination", workspace], owner).pipe(
    Effect.timeout(archiveTimeout),
  );
  const files = yield* fs.readDirectory(workspace);
  const archive = files.find((file) => file.endsWith(".tgz"));
  assert.isDefined(archive);
  const pathToArchive = path.join(workspace, archive);
  const contents = yield* run("tar", ["-tzf", pathToArchive], workspace).pipe(
    Effect.timeout(archiveTimeout),
  );
  assert.notMatch(contents, /\.(?:test|e2e)\.[cm]?[jt]sx?$/mu);
  yield* run("tar", ["-xzf", pathToArchive, "-C", workspace], workspace).pipe(
    Effect.timeout(archiveTimeout),
  );
});

const installConsumer = Effect.fnUntraced(function* (owner: string, workspace: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const packed = path.join(workspace, "package");
  const ownerModules = path.join(owner, "node_modules");
  const consumerModules = path.join(workspace, "node_modules");
  yield* fs.makeDirectory(path.join(consumerModules, "@effront"), { recursive: true });
  yield* fs.symlink(ownerModules, path.join(packed, "node_modules"));
  yield* fs.symlink(packed, path.join(consumerModules, "@effront/alchemy"));
  yield* Effect.forEach(
    dependencies,
    (dependency) =>
      fs.symlink(path.join(ownerModules, dependency), path.join(consumerModules, dependency)),
    { discard: true },
  );
});

const explicitLoaderChecks = `
          const uncaptured = applicationHttpEffect(load);
          export type Uncaptured = Assert<Equal<Effect.Services<typeof uncaptured>, Effect.Services<Native>>>;
          const phantom = applicationHttpEffect<ControlApi, Failure, Requirements, ControlApi>(load);
          export type PhantomNotProvided = Assert<Equal<Effect.Services<typeof phantom>, Effect.Services<Native>>>;
          const options: { readonly context?: Context.Context<ControlApi> } = {};
          const optional = applicationHttpEffect(load, options);
          export type OptionalNotProvided = Assert<Equal<Effect.Services<typeof optional>, Effect.Services<Native>>>;
          const captured = applicationHttpEffect(load, { context: Context.make(ControlApi, { read: () => "ok" }) });
          export type Provided = Assert<Equal<Effect.Services<typeof captured>, Effect.Services<Handler>>>;
          declare const hosts: Context.Context<Hosts>;
          const hostContext = applicationHttpEffect(load, { context: hosts });
          export type HostNotCaptured = Assert<Equal<Effect.Services<typeof hostContext>, Effect.Services<Native>>>;
`;

const consumerSource = ({ configured, entry }: Consumer): string => `
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
        ${configured ? "" : explicitLoaderChecks}
`;

const declarationImports = (content: string): string[] =>
  [
    ...content.matchAll(
      /(?:from\s*|import\()(?<quote>["'])(?<specifier>alchemy(?:\/[^"']*)?)\k<quote>/gu,
    ),
  ].flatMap(({ groups }) => {
    const specifier = groups?.["specifier"];
    return Predicate.isNullish(specifier) ? [] : [specifier];
  });

const resolveImports = Effect.fnUntraced(function* (workspace: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const output = path.join(workspace, "package/dist/cloudflare");
  const files = yield* fs.readDirectory(output);
  const imports = yield* Effect.forEach(
    files.filter((file) => file.endsWith(".d.ts")),
    (file) => fs.readFileString(path.join(output, file)).pipe(Effect.map(declarationImports)),
  );
  // Check package imports explicitly so skipLibCheck cannot turn them into error-any.
  const specifiers = [...new Set(imports.flat())];
  assert.isNotEmpty(specifiers);
  const probes = specifiers.map(
    (specifier, index) => `import * as module${index} from ${JSON.stringify(specifier)};`,
  );
  yield* fs.writeFileString(path.join(workspace, "resolution.ts"), probes.join("\n"));
});

const tsconfig = JSON.stringify({
  compilerOptions: {
    exactOptionalPropertyTypes: true,
    lib: ["ESNext", "DOM", "DOM.Iterable"],
    module: "ESNext",
    moduleResolution: "Bundler",
    noEmit: true,
    skipLibCheck: true,
    strict: true,
    target: "ESNext",
    types: [],
  },
  include: ["consumer-*.ts", "resolution.ts"],
});

const compileConsumer = Effect.fnUntraced(function* (workspace: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const manifest = yield* path.fromFileUrl(new URL(import.meta.resolve("typescript/package.json")));
  const compiler = path.join(path.dirname(manifest), "bin/tsc");
  const config = path.join(workspace, "tsconfig.json");
  yield* fs.writeFileString(config, tsconfig);
  yield* run(process.execPath, [compiler, "--project", config], workspace).pipe(
    Effect.timeout(compilerTimeout),
  );
});

const packageWorkspace = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repository = yield* path.fromFileUrl(new URL("../../../../", import.meta.url));
  const tmp = path.join(repository, "tmp");
  yield* fs.makeDirectory(tmp, { recursive: true });
  const workspace = yield* fs.makeTempDirectoryScoped({
    directory: tmp,
    prefix: "alchemy-declarations-",
  });
  return { owner: path.join(repository, "packages/alchemy"), workspace };
});

const declarations = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const { owner, workspace } = yield* packageWorkspace;
  yield* unpack(owner, workspace);
  yield* installConsumer(owner, workspace);
  yield* Effect.forEach(
    entries,
    (entry, index) =>
      fs.writeFileString(path.join(workspace, `consumer-${index}.ts`), consumerSource(entry)),
    { discard: true },
  );
  yield* resolveImports(workspace);
  yield* compileConsumer(workspace);
}).pipe(Effect.provide(NodeServices.layer));

describe("packed Alchemy declarations", () => {
  live(
    "preserves application capabilities through default and react-server exports",
    () => declarations,
    testTimeout,
  );
});
