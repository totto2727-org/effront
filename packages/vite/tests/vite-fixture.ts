import { Effect, FileSystem, Path } from "effect";
import type { Scope } from "effect";
import { createServer } from "vite";
import type { InlineConfig, ViteDevServer } from "vite";

export const exampleRoot = Effect.gen(function* () {
  const path = yield* Path.Path;
  return yield* path.fromFileUrl(new URL("../../../examples/basic/", import.meta.url));
});

export const fixtureDirectory = Effect.fn(function* (prefix: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* path.fromFileUrl(new URL("../../../tmp/", import.meta.url));
  yield* fs.makeDirectory(directory, { recursive: true });
  return yield* fs.makeTempDirectoryScoped({ directory, prefix });
});

export const startVite = (config: InlineConfig): Effect.Effect<ViteDevServer, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.promise(async () => createServer(config)),
    (server) => Effect.promise(async () => server.close()),
  );
