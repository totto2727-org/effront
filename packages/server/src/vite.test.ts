import { createServer as createHttpServer } from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { effront } from "@effront/vite";
import {
  createServer,
  isRunnableDevEnvironment,
  resolveConfig,
  type Plugin,
  type UserConfig,
  type ViteDevServer,
} from "vite";
import { afterEach, describe, expect, it, vi } from "vitest";

import { effrontServer } from "./vite";

const root = fileURLToPath(new URL("../../../tests/e2e-server/fixtures/node/", import.meta.url));
const resolveServerConfig = (config: UserConfig = {}, command: "serve" | "build" = "build") =>
  resolveConfig(
    {
      configFile: false,
      root,
      logLevel: "silent",
      plugins: [effront(), effrontServer()],
      ...config,
    },
    command,
    command === "build" ? "production" : "development",
    command === "build" ? "production" : "development",
  );

describe("effrontServer configuration", () => {
  it("builds separate native handler and startup entries without changing SSR conditions", async () => {
    const config = await resolveServerConfig();
    expect(config.environments["rsc"]?.build.rollupOptions.input).toEqual({
      index: "./src/entry.rsc.ts",
      server: "./src/entry.server.ts",
    });
    expect(config.environments["rsc"]?.build.rollupOptions.output).toMatchObject({
      entryFileNames: "[name].js",
    });
    expect(config.environments["rsc"]?.resolve.conditions).toContain("react-server");
    expect(config.environments["ssr"]?.resolve.conditions).not.toContain("react-server");
    expect(config.resolve.conditions).not.toContain("react-server");
    expect(config.environments["rsc"]?.resolve.noExternal).toContain("@effront/core");
    expect(config.environments["ssr"]?.resolve.noExternal).toContain("@effront/core");
    expect(config.resolve.dedupe).toContain("effect");
    expect(config.plugins.filter((plugin) => plugin.name === "rsc")).toHaveLength(1);
  });

  it("does not load the production startup entry during development", async () => {
    const config = await resolveServerConfig({}, "serve");
    expect(config.environments["rsc"]?.build.rollupOptions.input).toEqual({
      index: "./src/entry.rsc.ts",
    });
    for (const name of ["rsc", "ssr"]) {
      expect(config.environments[name]?.define?.["process.env.NODE_ENV"]).toBeUndefined();
    }
  });

  it.each(["production", "development", "test"])(
    "pins bundled server React to the resolved %s build mode without replacing other env",
    async (nodeEnv) => {
      vi.stubEnv("NODE_ENV", nodeEnv);
      const config = await resolveServerConfig({
        mode: "staging",
        environments: {
          rsc: { define: { "process.env.APPLICATION_FLAG": '"retained"' } },
          ssr: { define: { "process.env.APPLICATION_FLAG": '"retained"' } },
        },
      });
      expect(config.isProduction).toBe(nodeEnv === "production");
      for (const name of ["rsc", "ssr"]) {
        const environment = config.environments[name];
        const expected = JSON.stringify(config.isProduction ? "production" : "development");
        expect(environment?.define?.["process.env.NODE_ENV"]).toBe(expected);
        expect(environment?.define?.["global.process.env.NODE_ENV"]).toBe(expected);
        expect(environment?.define?.["globalThis.process.env.NODE_ENV"]).toBe(expected);
        expect(environment?.define?.["process.env.APPLICATION_FLAG"]).toBe('"retained"');
        expect(environment?.define?.["process.env"]).toBeUndefined();
        expect(environment?.define?.["process.env.PORT"]).toBeUndefined();
        expect(environment?.keepProcessEnv).toBe(true);
      }
    },
  );

  it("honors an explicit client NODE_ENV define for both server graphs", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const config = await resolveServerConfig({
      environments: {
        client: { define: { "process.env.NODE_ENV": '"development"' } },
        rsc: { define: { "process.env.NODE_ENV": '"production"' } },
      },
    });
    expect(config.isProduction).toBe(true);
    for (const name of ["rsc", "ssr"]) {
      expect(config.environments[name]?.define?.["process.env.NODE_ENV"]).toBe(
        config.environments["client"]?.define?.["process.env.NODE_ENV"],
      );
    }
  });

  it("uses final development mode when .env overrides the default production build", async () => {
    vi.stubEnv("NODE_ENV", undefined);
    vi.stubEnv("VITE_USER_NODE_ENV", undefined);
    const temporaryRoot = fileURLToPath(new URL("../../../tmp/", import.meta.url));
    await mkdir(temporaryRoot, { recursive: true });
    const envDir = await mkdtemp(join(temporaryRoot, "server-vite-env-"));
    try {
      await writeFile(join(envDir, ".env"), "NODE_ENV=development\n");
      const config = await resolveServerConfig({ envDir });
      expect(config.mode).toBe("production");
      expect(config.isProduction).toBe(false);
      for (const name of ["rsc", "ssr"]) {
        expect(config.environments[name]?.define?.["process.env.NODE_ENV"]).toBe('"development"');
      }
    } finally {
      await rm(envDir, { recursive: true, force: true });
    }
  });

  it("preserves other entries and output directories with custom host entries", async () => {
    const config = await resolveServerConfig({
      plugins: [
        effront(),
        effrontServer({ rsc: "./custom/handler.ts", server: "./custom/main.ts" }),
      ],
      environments: {
        rsc: {
          build: {
            outDir: "output/rsc",
            rollupOptions: { input: { other: "./custom/other.ts" } },
          },
        },
        ssr: { build: { outDir: "output/ssr" } },
        client: { build: { outDir: "output/client" } },
      },
    });
    expect(config.environments["rsc"]?.build.rollupOptions.input).toEqual({
      other: "./custom/other.ts",
      index: "./custom/handler.ts",
      server: "./custom/main.ts",
    });
    for (const name of ["rsc", "ssr", "client"]) {
      expect(config.environments[name]?.build.outDir).toBe(`${root}output/${name}`);
    }
  });

  it("rejects missing or incorrectly ordered portable integration", async () => {
    await expect(resolveServerConfig({ plugins: [effrontServer()] })).rejects.toThrow(
      "Register effront() before effrontServer()",
    );
    await expect(resolveServerConfig({ plugins: [effrontServer(), effront()] })).rejects.toThrow(
      "Register effront() before effrontServer()",
    );
  });

  it("rejects empty entry options", () => {
    expect(() => effrontServer({ rsc: "" })).toThrow(TypeError);
    expect(() => effrontServer({ server: "" })).toThrow(TypeError);
  });
});

const entry = "virtual:effront-native-http-test";
const resolvedEntry = `\0${entry}`;
const eventsKey = "__effront_native_http_test_events__";

const handlerSource = (version: string) => `
  import { Effect, Stream } from 'effect';
  import { HttpServerRequest, HttpServerResponse } from 'effect/unstable/http';
  export const handler = Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    if (request.url === '/stream') {
      yield* Effect.acquireRelease(
        Effect.sync(() => globalThis[${JSON.stringify(eventsKey)}].push('acquired')),
        () => Effect.sync(() => globalThis[${JSON.stringify(eventsKey)}].push('released')),
      );
      return HttpServerResponse.stream(
        Stream.concat(Stream.make(new TextEncoder().encode('streaming')), Stream.never),
      );
    }
    return HttpServerResponse.text(
      ${JSON.stringify(version)} + ':' + request.method + ':' + request.url + ':' + request.source.constructor.name,
    );
  });
  if (import.meta.hot) import.meta.hot.accept();
`;

const servers = new Set<ViteDevServer>();
afterEach(async () => {
  await Promise.all([...servers].map((server) => server.close()));
  servers.clear();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const setupServer = async (middlewareMode = false) => {
  let source = handlerSource("first");
  const fixture: Plugin = {
    name: "effront-native-http-fixture",
    resolveId: (id) => (id === entry ? resolvedEntry : undefined),
    load: (id) => (id === resolvedEntry ? source : undefined),
  };
  const server = await createServer({
    configFile: false,
    root,
    logLevel: "silent",
    plugins: [effront(), fixture, effrontServer({ rsc: entry })],
    server: { host: "127.0.0.1", port: 0, middlewareMode },
  });
  servers.add(server);
  return {
    server,
    change: (version: string) => {
      source = handlerSource(version);
    },
  };
};

const listen = async (server: ViteDevServer) => {
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("Missing HTTP server address");
  return `http://127.0.0.1:${address.port}`;
};

describe("effrontServer native middleware", () => {
  it("uses Vite's one listener, native requests, and the current runner module after HMR", async () => {
    const { server, change } = await setupServer();
    const origin = await listen(server);
    expect(server.httpServer?.listenerCount("request")).toBe(1);
    expect(await (await fetch(`${origin}/route?query=value`)).text()).toBe(
      "first:GET:/route?query=value:IncomingMessage",
    );
    const viteClient = await fetch(`${origin}/@vite/client`);
    expect(viteClient.status).toBe(200);
    expect(viteClient.headers.get("content-type")).toContain("javascript");

    const environment = server.environments["rsc"];
    if (!environment || !isRunnableDevEnvironment(environment)) {
      throw new Error("Missing runnable RSC environment");
    }
    const module = environment.moduleGraph.getModuleById(resolvedEntry);
    if (!module) throw new Error("RSC module was not loaded");
    change("second");
    await environment.reloadModule(module);
    await expect
      .poll(async () => (await fetch(`${origin}/route`)).text())
      .toBe("second:GET:/route:IncomingMessage");
  });

  it("retains request scope through streaming and releases it on client cancellation", async () => {
    const events: string[] = [];
    vi.stubGlobal(eventsKey, events);
    const { server } = await setupServer();
    const origin = await listen(server);
    const response = await fetch(`${origin}/stream`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Missing streaming response body");
    expect(new TextDecoder().decode((await reader.read()).value)).toBe("streaming");
    expect(events).toEqual(["acquired"]);
    await reader.cancel();
    await expect.poll(() => events).toEqual(["acquired", "released"]);
  });

  it("closes active request scopes when Vite closes in middleware mode", async () => {
    const events: string[] = [];
    vi.stubGlobal(eventsKey, events);
    const { server } = await setupServer(true);
    expect(server.httpServer).toBeNull();
    const host = createHttpServer(server.middlewares);
    await new Promise<void>((resolve) => host.listen(0, "127.0.0.1", resolve));
    try {
      const address = host.address();
      if (!address || typeof address === "string") throw new Error("Missing HTTP server address");
      const response = await fetch(`http://127.0.0.1:${address.port}/stream`);
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Missing streaming response body");
      await reader.read();
      expect(events).toEqual(["acquired"]);
      await server.close();
      expect(events).toEqual(["acquired", "released"]);
      await reader.cancel();
    } finally {
      host.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        host.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
