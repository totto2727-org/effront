import { once } from "node:events";
import { cp, mkdir, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { createServer, type RequestListener } from "node:http";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { effront } from "@effront/vite";
import { createBuilder, preview } from "vite";
import { expect, test } from "vitest";
import { effrontVercel } from "../dist/vite.js";

const temporary = fileURLToPath(new URL("../tmp/", import.meta.url));
const example = fileURLToPath(new URL("../../../examples/node/", import.meta.url));

test("builds the existing Node application into a self-contained Vercel function", async () => {
  await mkdir(temporary, { recursive: true });
  const root = await mkdtemp(join(temporary, "application-"));
  const server = createServer();
  try {
    await cp(join(example, "src"), join(root, "src"), { recursive: true });
    await cp(join(example, "public"), join(root, "public"), { recursive: true });
    await symlink(join(example, "node_modules"), join(root, "node_modules"), "dir");
    const builder = await createBuilder({
      configFile: false,
      root,
      logLevel: "silent",
      plugins: [effront(), effrontVercel()],
    });
    await builder.buildApp();
    const output = join(root, ".vercel/output");
    const { default: handler } = (await import(
      /* @vite-ignore */ pathToFileURL(join(output, "functions/index.func/rsc/server.js")).href
    )) as { default: RequestListener };
    server.on("request", handler);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string")
      throw new Error("Expected a TCP listener.");
    const response = await fetch(`http://127.0.0.1:${address.port}/`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("Hello, world!");
    const flight = await fetch(`http://127.0.0.1:${address.port}/about`, {
      headers: { accept: "text/x-component" },
    });
    expect(flight.status).toBe(200);
    expect(flight.headers.get("content-type")).toContain("text/x-component");
    expect(await flight.text()).toContain("About");
    await expect(readFile(join(output, "static/hello.txt"), "utf8")).resolves.toBe(
      await readFile(join(example, "public/hello.txt"), "utf8"),
    );
    const previewServer = await preview({
      configFile: false,
      root,
      logLevel: "silent",
      plugins: [effront(), effrontVercel()],
      preview: { host: "127.0.0.1", port: 0 },
    });
    try {
      const address = previewServer.httpServer.address();
      if (address === null || typeof address === "string")
        throw new Error("Expected a TCP listener.");
      const response = await fetch(`http://127.0.0.1:${address.port}/`);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("Hello, world!");
      const asset = await fetch(`http://127.0.0.1:${address.port}/hello.txt`);
      expect(await asset.text()).toBe(await readFile(join(example, "public/hello.txt"), "utf8"));
    } finally {
      await new Promise<void>((resolve, reject) => {
        previewServer.httpServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
  } finally {
    if (server.listening) {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
    await rm(root, { recursive: true, force: true });
  }
}, 120_000);

test("rejects a server dependency explicitly excluded from the function bundle", async () => {
  await mkdir(temporary, { recursive: true });
  const root = await mkdtemp(join(temporary, "external-"));
  try {
    await cp(join(example, "src"), join(root, "src"), { recursive: true });
    await symlink(join(example, "node_modules"), join(root, "node_modules"), "dir");
    const builder = await createBuilder({
      configFile: false,
      root,
      logLevel: "silent",
      plugins: [effront(), effrontVercel()],
      environments: { rsc: { resolve: { external: ["effect"] } } },
    });
    await expect(builder.buildApp()).rejects.toThrow("effect is external");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 120_000);

test("rejects a non-root Vite base instead of emitting broken asset routes", async () => {
  await expect(
    createBuilder({
      configFile: false,
      base: "/nested/",
      plugins: [effront(), effrontVercel()],
    }),
  ).rejects.toThrow(TypeError);
});
