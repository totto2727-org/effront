import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { writeBuildOutput } from "./output";

const temporary = fileURLToPath(new URL("../tmp/", import.meta.url));

const fixture = async () => {
  await mkdir(temporary, { recursive: true });
  const root = await mkdtemp(join(temporary, "output-"));
  for (const name of ["rsc", "ssr", "client"]) {
    await mkdir(join(root, "dist/vercel", name), { recursive: true });
  }
  await writeFile(join(root, "dist/vercel/rsc/server.js"), "export default () => {};");
  await writeFile(join(root, "dist/vercel/ssr/index.js"), "export {};");
  return root;
};

test("packages sibling server graphs privately and serves only client output statically", async () => {
  const root = await fixture();
  try {
    await writeFile(join(root, "dist/vercel/rsc/secret.txt"), "private");
    await writeFile(join(root, "dist/vercel/client/public.txt"), "public");
    await writeBuildOutput(root);
    const output = join(root, ".vercel/output");
    expect(JSON.parse(await readFile(join(output, "config.json"), "utf8"))).toEqual({
      version: 3,
      routes: [{ handle: "filesystem" }, { src: "/(.*)", dest: "/index" }],
    });
    expect(
      JSON.parse(await readFile(join(output, "functions/index.func/.vc-config.json"), "utf8")),
    ).toEqual({
      runtime: "nodejs22.x",
      handler: "rsc/server.js",
      launcherType: "Nodejs",
      supportsResponseStreaming: true,
    });
    await expect(readFile(join(output, "static/public.txt"), "utf8")).resolves.toBe("public");
    await expect(
      readFile(join(output, "functions/index.func/rsc/secret.txt"), "utf8"),
    ).resolves.toBe("private");
    await expect(readFile(join(output, "static/secret.txt"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("materializes linked static assets so deployment does not depend on the build machine", async () => {
  const root = await fixture();
  try {
    await writeFile(join(root, "asset.txt"), "linked asset");
    await symlink(join(root, "asset.txt"), join(root, "dist/vercel/client/linked.txt"));
    await writeBuildOutput(root);
    await rm(join(root, "asset.txt"));
    await expect(readFile(join(root, ".vercel/output/static/linked.txt"), "utf8")).resolves.toBe(
      "linked asset",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("keeps the previous deployment when a required server entry is missing", async () => {
  const root = await fixture();
  try {
    await mkdir(join(root, ".vercel/output"), { recursive: true });
    await writeFile(join(root, ".vercel/output/previous.txt"), "previous");
    await rm(join(root, "dist/vercel/rsc/server.js"));
    await expect(writeBuildOutput(root)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(root, ".vercel/output/previous.txt"), "utf8")).resolves.toBe(
      "previous",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("removes stale assets when replacing a previous successful output", async () => {
  const root = await fixture();
  try {
    await mkdir(join(root, ".vercel/output/static"), { recursive: true });
    await writeFile(join(root, ".vercel/output/static/stale.txt"), "stale");
    await writeBuildOutput(root);
    await expect(readFile(join(root, ".vercel/output/static/stale.txt"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
