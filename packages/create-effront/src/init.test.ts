import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stdout } from "node:process";
import { afterEach, expect, it, vi } from "vitest";
import { parseArgs, runCli } from "./cli.js";
import { createProject, platforms } from "./init.js";

const directories: string[] = [];

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
    expect(manifest.scripts.dev).toBe(platform === "alchemy-cloudflare" ? "alchemy dev" : "vp dev");
    expect(JSON.stringify(manifest)).not.toMatch(/workspace:|catalog:/);
    for (const example of examples) {
      const source = await readFile(
        new URL(`../../../examples/minimal/${example}/src/entry.effront.tsx`, import.meta.url),
        "utf8",
      );
      expect(application).toBe(source);
    }
    expect(await readdir(join(directory, "src"))).toContain("entry.effront.tsx");
    expect(await readFile(join(directory, ".gitignore"), "utf8")).toContain("node_modules/");
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
  expect(manifest.scripts).toMatchObject({
    dev: "vp dev",
    build: "vp build",
    deploy: "wrangler deploy",
  });
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

it("accepts each platform argument forwarded by vp create after --", () => {
  for (const platform of platforms) {
    expect(parseArgs(["app", "--platform", platform])).toEqual({ directory: "app", platform });
  }
});

it("describes the VitePlus forwarding syntax in help", async () => {
  const output = vi.spyOn(stdout, "write").mockImplementation(() => true);
  try {
    await runCli(["--help"]);
    expect(output).toHaveBeenCalledWith(
      expect.stringContaining(
        "vp create effront -- [directory] --platform node|bun|cloudflare|alchemy-cloudflare",
      ),
    );
  } finally {
    output.mockRestore();
  }
});

it("creates a project from forwarded VitePlus arguments and recommends vp commands", async () => {
  const directory = join(await temporaryDirectory(), "my-app");
  const output = vi.spyOn(stdout, "write").mockImplementation(() => true);
  try {
    await runCli([directory, "--platform", "cloudflare"]);
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

it("rejects an unknown platform and malformed command arguments", () => {
  expect(() => parseArgs(["app", "--platform", "workers"])).toThrow("--platform must be one of");
  expect(() => parseArgs(["app", "--unknown"])).toThrow("Unknown option");
  expect(() => parseArgs(["first", "second"])).toThrow("Unexpected argument");
});
