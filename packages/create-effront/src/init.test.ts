import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { parseArgs } from "./cli.js";
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
  it(`creates a standalone ${platform} project with the shared application`, async () => {
    const directory = join(await temporaryDirectory(), "My App");
    await createProject(directory, platform);
    const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
    const application = await readFile(join(directory, "src/entry.effront.tsx"), "utf8");
    const examples = ["hello-world", "hello-world-bun", "hello-world-cloudflare"];

    expect(manifest.name).toBe("my-app");
    expect(manifest.scripts.dev).toBe(platform === "cloudflare" ? "alchemy dev" : "vp dev");
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

it("keeps native hosting out of the Alchemy project", async () => {
  const directory = join(await temporaryDirectory(), "cloudflare");
  await createProject(directory, "cloudflare");
  const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
  const worker = await readFile(join(directory, "src/entry.workers.ts"), "utf8");
  expect(manifest.dependencies).toHaveProperty("@effront/alchemy", "0.1.4");
  expect(manifest.dependencies).not.toHaveProperty("@effront/server");
  expect(worker).toContain("makeApplicationHttpEffect");
  expect(await readdir(join(directory, "src"))).not.toContain("entry.server.ts");
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
