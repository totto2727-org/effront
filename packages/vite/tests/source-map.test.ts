import { createServer as createHttpServer, type Server } from "node:http";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { effront } from "@effront/vite";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const exampleRoot = fileURLToPath(new URL("../../../examples/alchemy/", import.meta.url));
const temporaryRoot = fileURLToPath(new URL("../../../tmp/", import.meta.url));

describe("RSC development source maps", () => {
  let vite: ViteDevServer;
  let http: Server;
  let origin: string;
  let directory: string;

  beforeAll(async () => {
    await mkdir(temporaryRoot, { recursive: true });
    directory = await mkdtemp(join(temporaryRoot, "source-map-test-"));
    vite = await createServer({
      configFile: false,
      root: exampleRoot,
      cacheDir: join(directory, "cache"),
      plugins: effront(),
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        watch: null,
        preTransformRequests: false,
      },
    });
    http = createHttpServer(vite.middlewares);
    await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
    const address = http.address();
    if (address === null || typeof address === "string") {
      throw new TypeError("Expected a local HTTP address.");
    }
    origin = `http://127.0.0.1:${address.port}`;
  }, 30_000);

  afterAll(async () => {
    if (http)
      await new Promise<void>((resolve, reject) =>
        http.close((error) => (error ? reject(error) : resolve())),
      );
    await vite?.close();
    if (directory)
      await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  });

  it.each([
    { environment: "rsc", name: "Server", path: "/src/entry.effront.tsx" },
    { environment: "client", name: "Client", path: "/src/components/counter.tsx" },
  ])(
    "serves the $name transform map through Vite's RSC endpoint",
    async ({ environment, name, path }) => {
      const graph = vite.environments[environment]!;
      await graph.transformRequest(path);
      const module = await graph.moduleGraph.getModuleByUrl(path);
      expect(module?.id).toBeTruthy();
      const filename = name === "Client" ? `${origin}${path}` : module!.id!;
      const url = new URL("/__vite_rsc_findSourceMapURL", origin);
      url.searchParams.set("filename", filename);
      url.searchParams.set("environmentName", name);
      const response = await fetch(url);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");
      const map = await response.json();
      expect(map).toMatchObject({ version: 3, sources: [path] });
      expect(map.mappings).not.toBe("");
    },
  );
});
