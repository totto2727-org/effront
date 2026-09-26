import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const tmp = join(root, "tmp");
const app = join(tmp, "app");

// Only test-owned copies are mutable. The public example remains unchanged.
await rm(app, { recursive: true, force: true });
if (process.env.EFFRONT_TEST_WARM !== "1") {
  await rm(join(root, ".vite-cache"), { recursive: true, force: true });
} else {
  const metadata = JSON.parse(
    await readFile(join(root, ".vite-cache/deps_rsc/_metadata.json"), "utf8"),
  );
  if (!metadata.optimized["@effront-test/optimizer-c"])
    throw new Error("Warm acceptance requires the completed cold acceptance cache");
  await writeFile(join(tmp, "warm-cache.json"), JSON.stringify(metadata));
}
await mkdir(app, { recursive: true });
await cp(new URL("../../examples/alchemy/src/", import.meta.url), join(app, "src"), {
  recursive: true,
});
await cp(new URL("./fixture/diagnostics.ts", import.meta.url), join(app, "src/diagnostics.ts"));
const workerPath = join(app, "src/entry.workers.ts");
const worker = await readFile(workerPath, "utf8");
const instrumented = worker.replace(
  "fetch: fetch.pipe(Effect.orDie)",
  "fetch: withDiagnostics(fetch, cache).pipe(Effect.orDie)",
);
if (instrumented === worker) throw new Error("Native example Worker shape changed");
await writeFile(workerPath, 'import { withDiagnostics } from "./diagnostics";\n' + instrumented);
const counterPath = join(app, "src/components/counter.tsx");
const counter = await readFile(counterPath, "utf8");
const hydratedCounter = counter
  .replace("import { useState }", "import { useEffect, useState }")
  .replace(
    "  return (",
    "  const [hydrated, setHydrated] = useState(false);\n  useEffect(() => setHydrated(true), []);\n  return (",
  )
  .replace("    <button", "    <button data-test-hydrated={hydrated}");
if (hydratedCounter === counter) throw new Error("Counter fixture shape changed");
await writeFile(counterPath, hydratedCounter);
await writeFile(
  join(app, "src/accepted-hmr.ts"),
  'document.documentElement.setAttribute("data-test-accepted", "before");\nif (import.meta.hot) import.meta.hot.accept();\n',
);
await writeFile(join(app, "src/late-dependency.ts"), 'export const value = "initial";\n');
await writeFile(join(app, "package.json"), '{"private":true,"type":"module"}\n');
// Real bare CommonJS packages sharing different children force the optimizer to
// split an already optimized entry twice. Merely discovering a new dep is not enough.
const packages = {
  "shared-one": 'exports.value = "one";',
  "shared-two": 'exports.value = "two";',
  "optimizer-a":
    'exports.value = require("@effront-test/shared-one").value + require("@effront-test/shared-two").value;',
  "optimizer-b": 'exports.value = require("@effront-test/shared-one").value;',
  "optimizer-c": 'exports.value = require("@effront-test/shared-two").value;',
};
for (const [name, source] of Object.entries(packages)) {
  const directory = join(app, "node_modules/@effront-test", name);
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, "package.json"),
    JSON.stringify({ name: `@effront-test/${name}`, version: "1.0.0", main: "index.cjs" }),
  );
  await writeFile(join(directory, "index.cjs"), `${source}\n`);
}
