import { Effect, FileSystem, Path, Schedule } from "effect";
import type { Scope } from "effect";
import { createServer } from "vite";
import type { InlineConfig, ServerOptions, ViteDevServer } from "vite";

// oxlint-disable-next-line unicorn/no-null -- Vite uses null to disable filesystem watching for read-only fixtures.
const disabledWatch = null;
const cleanupRetries = 3;

export const quietServer = {
  hmr: false,
  preTransformRequests: false,
  watch: disabledWatch,
  ws: false,
} satisfies ServerOptions;

export const exampleRoot = Effect.gen(function* () {
  const path = yield* Path.Path;
  return yield* path.fromFileUrl(new URL("../../../examples/basic/", import.meta.url));
});

export const fixtureDirectory = Effect.fnUntraced(function* (prefix: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* path.fromFileUrl(new URL("../../../tmp/", import.meta.url));
  yield* fs.makeDirectory(directory, { recursive: true });
  return yield* Effect.acquireRelease(fs.makeTempDirectory({ directory, prefix }), (created) =>
    fs.remove(created, { force: true, recursive: true }).pipe(
      // The Vite optimizer can finish pending cache writes just after the server closes.
      Effect.retry({ schedule: Schedule.spaced("100 millis"), times: cleanupRetries }),
      Effect.orDie,
    ),
  );
});

export const startVite = (config: InlineConfig): Effect.Effect<ViteDevServer, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.promise(async () => createServer(config)),
    (server) => Effect.promise(async () => server.close()),
  );
