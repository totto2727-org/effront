import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { Command } from "effect/unstable/cli";
import packageJson from "../package.json" with { type: "json" };
import { command } from "./cli.js";
import { createProject, platforms } from "./init.js";

const directories: string[] = [];
const runCommand = Command.runWith(command, { version: packageJson.version });

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "create-effront-test-"));
  directories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

for (const platform of platforms) {
  it(`creates a ${platform} project with the shared application`, async () => {
    const directory = join(await temporaryDirectory(), "My App");
    await createProject(directory, platform);
    const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
    const application = await readFile(join(directory, "src/entry.effront.tsx"), "utf8");
    const examples = ["node", "bun", "cloudflare", "alchemy-cloudflare"];

    expect(manifest.name).toBe("my-app");
    if (platform === "alchemy-cloudflare") {
      expect(manifest.scripts).toEqual({ dev: "alchemy dev" });
    } else {
      expect(manifest.scripts).not.toHaveProperty("dev");
      expect(manifest.scripts).not.toHaveProperty("build");
    }
    expect(JSON.stringify(manifest)).not.toMatch(/workspace:|catalog:/);
    for (const example of examples) {
      const source = await readFile(
        new URL(`../../../examples/${example}/src/entry.effront.tsx`, import.meta.url),
        "utf8",
      );
      expect(application).toBe(source);
    }
    expect(await readdir(join(directory, "src"))).toContain("entry.effront.tsx");
    expect(await readFile(join(directory, ".gitignore"), "utf8")).toContain("node_modules/");
  });
}

for (const platform of platforms) {
  it(`keeps generated ${platform} host entries aligned with the runnable example`, async () => {
    const directory = join(await temporaryDirectory(), platform);
    await createProject(directory, platform);
    const hostFiles = [
      "vite.config.ts",
      ...(platform === "node" || platform === "bun"
        ? ["src/entry.rsc.ts", "src/entry.server.ts"]
        : platform === "cloudflare"
          ? ["src/entry.workers.ts"]
          : []),
    ];
    for (const file of hostFiles) {
      expect(await readFile(join(directory, file), "utf8")).toBe(
        await readFile(new URL(`../../../examples/${platform}/${file}`, import.meta.url), "utf8"),
      );
    }
  });
}

it("creates a standalone Cloudflare Worker without Alchemy or bindings", async () => {
  const directory = join(await temporaryDirectory(), "cloudflare");
  await createProject(directory, "cloudflare");
  const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
  const worker = await readFile(join(directory, "src/entry.workers.ts"), "utf8");
  const config = await readFile(join(directory, "vite.config.ts"), "utf8");
  const wrangler = JSON.parse(await readFile(join(directory, "wrangler.json"), "utf8"));
  expect(manifest.dependencies).toHaveProperty("@effront/cloudflare", "0.1.4");
  expect(manifest.dependencies).not.toHaveProperty("@effront/alchemy");
  expect(manifest.dependencies).not.toHaveProperty("alchemy");
  expect(manifest.dependencies).not.toHaveProperty("@effront/server");
  expect(manifest.devDependencies).toHaveProperty("wrangler", "4.131.0");
  expect(manifest.scripts).toEqual({ deploy: "wrangler deploy" });
  expect(worker).toContain("createFetchHandler(application)");
  expect(config).toContain("effrontCloudflare()");
  expect(config).not.toContain("server:");
  expect(wrangler).toMatchObject({ name: "cloudflare", main: "src/entry.workers.ts" });
  expect(wrangler).not.toHaveProperty("vars");
  expect(wrangler).not.toHaveProperty("assets");
  expect(await readdir(directory)).not.toContain("alchemy.run.ts");
  expect(await readdir(join(directory, "src"))).not.toContain("entry.server.ts");
});

it("keeps standalone Cloudflare hosting out of the Alchemy project", async () => {
  const directory = join(await temporaryDirectory(), "alchemy-cloudflare");
  await createProject(directory, "alchemy-cloudflare");
  const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
  const worker = await readFile(join(directory, "src/entry.workers.ts"), "utf8");
  const config = await readFile(join(directory, "vite.config.ts"), "utf8");
  const runner = await readFile(join(directory, "alchemy.run.ts"), "utf8");
  expect(manifest.dependencies).toHaveProperty("@effront/alchemy", "0.1.4");
  expect(manifest.dependencies).not.toHaveProperty("@effront/cloudflare");
  expect(manifest.dependencies).not.toHaveProperty("@effront/server");
  expect(worker).toContain("makeApplicationHttpEffect");
  expect(config).toContain("effrontAlchemy()");
  expect(config).not.toContain("server:");
  expect(runner).toContain('"alchemy-cloudflare"');
  expect(worker).not.toContain("dev: { port:");
  expect(await readdir(directory)).not.toContain("wrangler.json");
  expect(await readdir(join(directory, "src"))).not.toContain("entry.server.ts");
});

for (const platform of ["node", "bun"] as const) {
  it(`uses Vite defaults and optional host environment settings for ${platform}`, async () => {
    const directory = join(await temporaryDirectory(), platform);
    await createProject(directory, platform);
    const config = await readFile(join(directory, "vite.config.ts"), "utf8");
    const server = await readFile(join(directory, "src/entry.server.ts"), "utf8");
    expect(config).not.toContain("server:");
    expect(server).toContain('process.env["PORT"]');
    expect(server).toContain('process.env["HOST"]');
    expect(server).toContain("...(port ? { port: Number(port) } : {})");
    expect(server).toContain("...(hostname ? { hostname } : {})");
    expect(server).not.toContain("port: undefined");
    expect(server).not.toMatch(/1340|1343|127\.0\.0\.1/);
  });
}

for (const platform of platforms) {
  it(`accepts the ${platform} flag forwarded by vp create`, async () => {
    const directory = join(await temporaryDirectory(), `forwarded-${platform}`);
    const output = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await Effect.runPromise(
        runCommand([directory, "--platform", platform]).pipe(Effect.provide(NodeServices.layer)),
      );
      expect(JSON.parse(await readFile(join(directory, "package.json"), "utf8"))).toHaveProperty(
        "name",
        `forwarded-${platform}`,
      );
    } finally {
      output.mockRestore();
    }
  });
}

it("describes supported platforms in framework-generated help", async () => {
  const output = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    await Effect.runPromise(runCommand(["--help"]).pipe(Effect.provide(NodeServices.layer)));
    expect(output).toHaveBeenCalledWith(expect.stringContaining("--platform"));
    expect(output).toHaveBeenCalledWith(expect.stringContaining("alchemy-cloudflare"));
  } finally {
    output.mockRestore();
  }
});

it("creates a project from forwarded VitePlus arguments and recommends vp commands", async () => {
  const directory = join(await temporaryDirectory(), "my-app");
  const output = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    await Effect.runPromise(
      runCommand([directory, "--platform", "cloudflare"]).pipe(Effect.provide(NodeServices.layer)),
    );
    expect(output).toHaveBeenCalledWith(
      expect.stringContaining(`Next: cd ${directory} && vp install && vp dev`),
    );
    expect(JSON.parse(await readFile(join(directory, "wrangler.json"), "utf8"))).toHaveProperty(
      "name",
      "my-app",
    );
  } finally {
    output.mockRestore();
  }
});

it("refuses to overwrite an existing project", async () => {
  const directory = await temporaryDirectory();
  await writeFile(join(directory, "keep.txt"), "preserve me");
  await expect(createProject(directory, "node")).rejects.toThrow("not empty");
  expect(await readFile(join(directory, "keep.txt"), "utf8")).toBe("preserve me");
  expect(await readdir(directory)).toEqual(["keep.txt"]);
});

it("rejects invalid platform and unexpected options without creating a project", async () => {
  const directory = join(await temporaryDirectory(), "invalid");
  await expect(
    Effect.runPromise(
      runCommand([directory, "--platform", "workers"]).pipe(Effect.provide(NodeServices.layer)),
    ),
  ).rejects.toThrow();
  await expect(
    Effect.runPromise(
      runCommand([directory, "--unknown"]).pipe(Effect.provide(NodeServices.layer)),
    ),
  ).rejects.toThrow();
  await expect(
    Effect.runPromise(
      runCommand([directory, "--platform="]).pipe(Effect.provide(NodeServices.layer)),
    ),
  ).rejects.toThrow();
  await expect(
    Effect.runPromise(
      runCommand([directory, "extra", "--platform", "node"]).pipe(
        Effect.provide(NodeServices.layer),
      ),
    ),
  ).rejects.toThrow();
  await expect(readdir(directory)).rejects.toThrow();
});

it("rejects missing options without a terminal", async () => {
  await expect(
    Effect.runPromise(runCommand([]).pipe(Effect.provide(NodeServices.layer))),
  ).rejects.toThrow("Specify a directory and --platform in non-interactive mode.");
});

it("recommends Alchemy orchestration rather than a direct Vite dev command", async () => {
  const directory = join(await temporaryDirectory(), "alchemy-app");
  const output = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    await Effect.runPromise(
      runCommand([directory, "--platform", "alchemy-cloudflare"]).pipe(
        Effect.provide(NodeServices.layer),
      ),
    );
    expect(output).toHaveBeenCalledWith(
      expect.stringContaining(`Next: cd ${directory} && vp install && vp run dev`),
    );
  } finally {
    output.mockRestore();
  }
});
