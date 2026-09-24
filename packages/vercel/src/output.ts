import { cp, mkdir, mkdtemp, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Packages only adapter-owned, fully bundled Vite output. No dependency tracing is implied. */
export const writeBuildOutput = async (root: string) => {
  const build = join(root, "dist/vercel");
  // Validate required output before touching a previous successful deployment.
  await Promise.all([
    stat(join(build, "rsc/server.js")),
    stat(join(build, "ssr/index.js")),
    stat(join(build, "client")),
  ]);
  const vercel = join(root, ".vercel");
  await mkdir(vercel, { recursive: true });
  const staging = await mkdtemp(join(vercel, "effront-output-"));
  try {
    const functionDirectory = join(staging, "functions/index.func");
    await mkdir(functionDirectory, { recursive: true });
    // Copy sequentially so failure cleanup cannot race a still-running copy.
    await cp(join(build, "rsc"), join(functionDirectory, "rsc"), {
      recursive: true,
      dereference: true,
    });
    await cp(join(build, "ssr"), join(functionDirectory, "ssr"), {
      recursive: true,
      dereference: true,
    });
    await cp(join(build, "client"), join(staging, "static"), {
      recursive: true,
      dereference: true,
    });
    await writeFile(join(functionDirectory, "package.json"), JSON.stringify({ type: "module" }));
    await writeFile(
      join(functionDirectory, ".vc-config.json"),
      JSON.stringify({
        runtime: "nodejs22.x",
        handler: "rsc/server.js",
        launcherType: "Nodejs",
        supportsResponseStreaming: true,
      }),
    );
    await writeFile(
      join(staging, "config.json"),
      JSON.stringify({
        version: 3,
        routes: [{ handle: "filesystem" }, { src: "/(.*)", dest: "/index" }],
      }),
    );
    const output = join(vercel, "output");
    const backup = `${staging}-previous`;
    let previous = false;
    try {
      await rename(output, backup);
      previous = true;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    try {
      await rename(staging, output);
    } catch (error) {
      if (previous) {
        try {
          await rename(backup, output);
        } catch (restoreError) {
          // Do not clean up the backup if restoring it failed.
          throw new AggregateError(
            [error, restoreError],
            `Previous Vercel output remains at ${backup}.`,
          );
        }
      }
      throw error;
    }
    if (previous) await rm(backup, { recursive: true, force: true });
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
};
