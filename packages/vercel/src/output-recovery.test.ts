import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, vi } from "vitest";
import { writeBuildOutput } from "./output";

vi.mock("node:fs/promises", async (importOriginal) => {
  const fs = await importOriginal<typeof import("node:fs/promises")>();
  return { ...fs, rename: vi.fn(fs.rename) };
});

test("restores the successful deployment when swapping in the new directory fails", async () => {
  const temporary = fileURLToPath(new URL("../tmp/", import.meta.url));
  await mkdir(temporary, { recursive: true });
  const root = await mkdtemp(join(temporary, "recovery-"));
  const fs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  const failure = new Error("Simulated filesystem rename failure");
  try {
    for (const directory of [
      "dist/vercel/rsc",
      "dist/vercel/ssr",
      "dist/vercel/client",
      ".vercel/output",
    ]) {
      await mkdir(join(root, directory), { recursive: true });
    }
    await writeFile(join(root, "dist/vercel/rsc/server.js"), "export default () => {};");
    await writeFile(join(root, "dist/vercel/ssr/index.js"), "export {};");
    await writeFile(join(root, ".vercel/output/previous.txt"), "previous");
    vi.mocked(rename).mockImplementationOnce(fs.rename).mockRejectedValueOnce(failure);
    await expect(writeBuildOutput(root)).rejects.toBe(failure);
    await expect(readFile(join(root, ".vercel/output/previous.txt"), "utf8")).resolves.toBe(
      "previous",
    );
    await expect(readdir(join(root, ".vercel"))).resolves.toEqual(["output"]);
  } finally {
    vi.mocked(rename).mockReset().mockImplementation(fs.rename);
    await rm(root, { recursive: true, force: true });
  }
});
