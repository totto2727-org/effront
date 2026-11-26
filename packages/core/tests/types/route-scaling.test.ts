// oxlint-disable-next-line rules/no-node-imports -- Measure the installed TypeScript compiler in a separate process.
import { execFile } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- The benchmark writes and disposes actual compiler inputs.
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Pass native checkout paths to the TypeScript subprocess.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Convert the compiler and repository module URLs to physical paths.
import { fileURLToPath } from "node:url";

import { Data, Predicate } from "effect";
import { describe, expect, test } from "vitest";

const compilerTimeout = 30_000;
const pair = 2;
const setupAllowance = 5000;
const testTimeout = pair * compilerTimeout + setupAllowance;
const noInstantiations = 0;
const smallRouteCount = 100;
const largeRouteCount = 400;
const maximumGrowth = 6;
const even = 0;

const repository = fileURLToPath(new URL("../../../../", import.meta.url));
const typescriptPackage = fileURLToPath(import.meta.resolve("typescript/package.json"));
const compiler = path.join(path.dirname(typescriptPackage), "bin/tsc");
const source = path.resolve(repository, "packages/core/src/application");
const temporaryRoot = path.join(repository, "tmp");

class MissingCompilerDiagnostics extends Data.TaggedError("MissingCompilerDiagnostics")<{
  output: string;
}> {}

const makeRoutes = (count: number): string =>
  [
    `import type { RoutesFactory } from ${JSON.stringify(path.join(source, "routes"))};`,
    `import type { StaticPageDefinition, ParameterizedPageDefinition } from ${JSON.stringify(path.join(source, "page"))};`,
    "declare const Routes: RoutesFactory<never>;",
    "declare const staticPage: StaticPageDefinition<never>;",
    "declare const dynamicPage: ParameterizedPageDefinition<never, 'id'>;",
    "export const routes = Routes.make()",
    ...Array.from({ length: count }, (_item, index) =>
      index % pair === even
        ? `.page('/route${index}', staticPage)`
        : `.page('/route${index}/:id', dynamicPage)`,
    ),
    ";",
  ].join("\n");

const compile = async (config: string): Promise<string> => {
  const result = Promise.withResolvers<string>();
  const args = [compiler, "--project", config, "--extendedDiagnostics"];
  execFile(
    process.execPath,
    args,
    { encoding: "utf8", timeout: compilerTimeout },
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- Native execFile supplies the compiler output through a callback, which this helper adapts once.
    (error, stdout) => {
      if (Predicate.isNullish(error)) {
        result.resolve(stdout);
      } else {
        result.reject(error);
      }
    },
  );
  return result.promise;
};

const measure = async (workspace: string, count: number): Promise<number> => {
  await writeFile(path.join(workspace, "routes.ts"), makeRoutes(count));
  const output = await compile(path.join(workspace, "tsconfig.json"));
  const countText = /^Instantiations:\s+(?<count>\d+)/mu.exec(output)?.groups?.["count"];
  if (Predicate.isNullish(countText)) {
    throw new MissingCompilerDiagnostics({ output });
  }
  return Number(countText);
};

const writeProject = async (workspace: string): Promise<void> => {
  const config = {
    extends: path.resolve(repository, "tsconfig.json"),
    files: ["routes.ts"],
    include: [],
  };
  await writeFile(path.join(workspace, "tsconfig.json"), JSON.stringify(config));
};

describe("route checker work", () => {
  test(
    "quadrupling a route chain uses less than six times the type instantiations",
    async () => {
      expect.hasAssertions();
      await mkdir(temporaryRoot, { recursive: true });
      const workspace = await mkdtemp(path.join(temporaryRoot, "effront-route-scaling-"));
      try {
        await writeProject(workspace);
        const small = await measure(workspace, smallRouteCount);
        const large = await measure(workspace, largeRouteCount);
        expect(small).toBeGreaterThan(noInstantiations);
        // Count checker work instead of elapsed time so machine load cannot change the verdict.
        expect(large).toBeLessThan(small * maximumGrowth);
      } finally {
        await rm(workspace, { force: true, recursive: true });
      }
    },
    testTimeout,
  );
});
