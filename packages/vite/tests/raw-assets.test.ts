import { live } from "@effect/vitest";
import { NodeServices } from "@effect/platform-node";
import { effront } from "@effront/vite";
import { Effect, FileSystem, Path } from "effect";
import type { Scope } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
import { assert, describe, expect, vi } from "vitest";

import { exampleRoot, fixtureDirectory, startVite } from "./vite-fixture.ts";

const prepareFixture = Effect.fn(function* (files: Readonly<Record<string, string>>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fixtureDirectory("raw-assets-test-");
  yield* Effect.forEach(
    Object.entries(files),
    ([name, content]) => fs.writeFileString(path.join(root, name), content),
    { discard: true },
  );
  return { path, root };
});

const open = Effect.fn(function* (files: Readonly<Record<string, string>>) {
  const { path, root } = yield* prepareFixture(files);
  const consumer = yield* exampleRoot;
  const entry = path.join(root, "entry.ts");
  const server = yield* startVite({
    cacheDir: path.join(root, "cache"),
    configFile: false,
    optimizeDeps: { include: [], noDiscovery: true },
    plugins: effront({ application: entry, rsc: entry }),
    root: consumer,
    server: { host: "127.0.0.1", port: 0, preTransformRequests: false },
  });
  yield* Effect.promise(async () => server.listen());
  // The test fixtures live outside the consumer directory watched by default.
  server.watcher.add(root);
  const { client, rsc } = server.environments;
  assert.isDefined(client);
  assert.isDefined(rsc);
  return { client, root, rsc, server };
});

const serve = Effect.fn(function* (files: Readonly<Record<string, string>>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const opened = yield* open(files);
  const file = (name: string): string => path.join(opened.root, name);
  const waitForWatch = (name: string): Effect.Effect<void> =>
    Effect.promise(async () => {
      await expect.poll(() => opened.server.watcher.getWatched()[opened.root]).toContain(name);
    });
  const edit = Effect.fn(function* (name: string, content: string) {
    yield* waitForWatch(name);
    yield* fs.writeFileString(file(name), content);
  });
  const remove = Effect.fn(function* (name: string) {
    yield* waitForWatch(name);
    yield* fs.remove(file(name));
  });
  return {
    ...opened,
    edit,
    file,
    remove,
    url: (name: string) => `/@fs${file(name)}`,
  };
}, Effect.provide(NodeServices.layer));

type Fixture = Effect.Success<ReturnType<typeof serve>>;
type Messages = () => unknown[];

const captureMessages = (fixture: Fixture): Effect.Effect<Messages, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.sync(() => vi.spyOn(fixture.client.hot, "send")),
    (send) =>
      Effect.sync(() => {
        send.mockRestore();
      }),
  ).pipe(Effect.map((send) => () => send.mock.calls.map(([payload]) => payload)));

const transform = (fixture: Fixture, names: string[]): Effect.Effect<void> =>
  Effect.forEach(
    names,
    (name) => Effect.promise(async () => fixture.rsc.transformRequest(fixture.url(name))),
    { discard: true },
  );

const waitForMessage = (messages: Messages, expected: unknown): Effect.Effect<void> =>
  Effect.promise(async () => {
    await expect.poll(messages).toContainEqual(expected);
  });

const matchRscUpdate = (messages: Messages, file: string): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* waitForMessage(messages, { data: { file }, event: "rsc:update", type: "custom" });
    expect(messages()).not.toContainEqual(expect.objectContaining({ type: "error" }));
  });

const expectRawWatchEdge = (fixture: Fixture, name: string): void => {
  const bare = fixture.rsc.moduleGraph.getModuleById(fixture.file(name));
  assert.isDefined(bare);
  const importers = [...bare.importers].map(({ id }) => id);
  expect({ importers, type: bare.type }).toStrictEqual({
    importers: [`${fixture.file(name)}?raw`],
    type: "js",
  });
};

const readAsset = Effect.fn(function* (fixture: Fixture, file: string) {
  const [origin] = fixture.server.resolvedUrls?.local ?? [];
  assert.isDefined(origin);
  const target = new URL(fixture.url(file), origin);
  const response = yield* HttpClient.get(target).pipe(Effect.provide(FetchHttpClient.layer));
  return { status: response.status, text: yield* response.text };
});

const jsFiles = {
  "entry.ts": 'export { default } from "./module.js?raw";\n',
  "module.js": 'export const value = "initial";\n',
};

describe("queryless dependencies of raw imports", () => {
  live.each(["document.md", "template.txt"])(
    "updates %s without parsing its queryless watch dependency",
    (name) =>
      Effect.gen(function* () {
        const fixture = yield* serve({
          [name]: "# Initial text\n\nPlain text, not JavaScript.\n",
          "entry.ts": `export { default } from "./${name}?raw";\n`,
        });
        yield* transform(fixture, ["entry.ts", `${name}?raw`]);
        expectRawWatchEdge(fixture, name);
        const messages = yield* captureMessages(fixture);
        yield* fixture.edit(name, "# Updated text\n\nFresh raw contents.\n");
        yield* matchRscUpdate(messages, fixture.file(name));
        const updated = yield* Effect.promise(async () =>
          fixture.rsc.transformRequest(fixture.url(`${name}?raw`)),
        );
        expect(updated?.code).toContain("Updated text");
        expect(updated?.code).toContain("Fresh raw contents.");
      }),
  );
});

describe("raw glob deletions", () => {
  live("removes a deleted raw glob entry without loading the missing file", () =>
    Effect.gen(function* () {
      const fixture = yield* serve({
        "deleted.md": "# Deleted page\n",
        "entry.ts":
          'export const pages = import.meta.glob("./*.md", { eager: true, query: "?raw", import: "default" });\n',
        "kept.md": "# Kept page\n",
      });
      yield* transform(fixture, ["entry.ts", "kept.md?raw", "deleted.md?raw"]);
      const messages = yield* captureMessages(fixture);
      yield* fixture.remove("deleted.md");
      yield* matchRscUpdate(messages, fixture.file("deleted.md"));
      const updated = yield* Effect.promise(async () =>
        fixture.rsc.transformRequest(fixture.url("entry.ts")),
      );
      expect(updated?.code).toContain("kept.md");
      expect(updated?.code).not.toContain("deleted.md");
    }),
  );
});

describe("modules loaded as JavaScript and raw text", () => {
  live("still transforms an independently loaded JavaScript module", () =>
    Effect.gen(function* () {
      const fixture = yield* serve(jsFiles);
      yield* transform(fixture, ["entry.ts", "module.js?raw", "module.js"]);
      const spy = vi.spyOn(fixture.rsc, "transformRequest");
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          spy.mockRestore();
        }),
      );
      const messages = yield* captureMessages(fixture);
      yield* fixture.edit("module.js", 'export const value = "updated";\n');
      yield* matchRscUpdate(messages, fixture.file("module.js"));
      expect(spy.mock.calls.map(([url]) => url)).toContain(fixture.url("module.js"));
      const updated = yield* Effect.promise(async () =>
        fixture.rsc.transformRequest(fixture.url("module.js")),
      );
      expect(updated?.code).toContain('"updated"');
    }),
  );

  live("preserves syntax-error reporting for a live JavaScript module", () =>
    Effect.gen(function* () {
      const fixture = yield* serve(jsFiles);
      yield* transform(fixture, ["entry.ts", "module.js?raw", "module.js"]);
      const messages = yield* captureMessages(fixture);
      yield* fixture.edit("module.js", "export const value = ;\n");
      yield* waitForMessage(messages, expect.objectContaining({ type: "error" }));
    }),
  );
});

describe("ordinary client asset updates", () => {
  live("preserves CSS hot updates", () =>
    Effect.gen(function* () {
      const fixture = yield* serve({
        "entry.ts": 'import "./style.css";\n',
        "style.css": ".example { color: red; }\n",
      });
      yield* Effect.promise(async () => fixture.client.transformRequest(fixture.url("entry.ts")));
      yield* Effect.promise(async () => fixture.client.transformRequest(fixture.url("style.css")));
      const messages = yield* captureMessages(fixture);
      yield* fixture.edit("style.css", ".example { color: blue; }\n");
      const update: unknown = expect.objectContaining({
        path: fixture.url("style.css"),
        type: "js-update",
      });
      yield* waitForMessage(
        messages,
        expect.objectContaining({ type: "update", updates: [update] }),
      );
      const updated = yield* Effect.promise(async () =>
        fixture.client.transformRequest(fixture.url("style.css")),
      );
      expect(updated?.code).toContain("color: blue");
    }),
  );
});

describe("client image URL updates", () => {
  live("preserves hot updates and serves changed asset bytes", () =>
    Effect.gen(function* () {
      const fixture = yield* serve({
        "diagram.svg": '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="red"/></svg>',
        "entry.ts":
          'import image from "./diagram.svg?url"; export default image; import.meta.hot.accept();\n',
      });
      yield* Effect.promise(async () => fixture.client.transformRequest(fixture.url("entry.ts")));
      yield* Effect.promise(async () =>
        fixture.client.transformRequest(fixture.url("diagram.svg?url")),
      );
      const messages = yield* captureMessages(fixture);
      const changed = '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="blue"/></svg>';
      yield* fixture.edit("diagram.svg", changed);
      const update: unknown = expect.objectContaining({ type: "js-update" });
      yield* waitForMessage(
        messages,
        expect.objectContaining({ type: "update", updates: [update] }),
      );
      expect(yield* readAsset(fixture, "diagram.svg")).toStrictEqual({
        status: 200,
        text: changed,
      });
    }),
  );
});
