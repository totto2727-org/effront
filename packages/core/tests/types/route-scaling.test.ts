// This test measures the installed TypeScript compiler in a separate process.
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { expect, test } from "vitest";

const exec = promisify(execFile);
const compilerTimeout = 30_000;
const testTimeout = 2 * compilerTimeout + 5000;

const repository = fileURLToPath(new URL("../../../../", import.meta.url));
const compiler = join(
  dirname(fileURLToPath(import.meta.resolve("typescript/package.json"))),
  "bin/tsc",
);

test(
  "quadrupling a route chain uses less than six times the type instantiations",
  async () => {
    const temporaryRoot = join(repository, "tmp");
    await mkdir(temporaryRoot, { recursive: true });
    const workspace = await mkdtemp(join(temporaryRoot, "effront-route-scaling-"));
    try {
      await writeFile(
        join(workspace, "tsconfig.json"),
        JSON.stringify({
          extends: resolve(repository, "tsconfig.json"),
          files: ["routes.ts"],
          include: [],
        }),
      );

      const measure = async (count: number): Promise<number> => {
        const source = resolve(repository, "packages/core/src/application");
        await writeFile(
          join(workspace, "routes.ts"),
          [
            `import type { RoutesFactory } from ${JSON.stringify(join(source, "routes"))};`,
            `import type { StaticPageDefinition, ParameterizedPageDefinition } from ${JSON.stringify(join(source, "page"))};`,
            "declare const Routes: RoutesFactory<never>;",
            "declare const staticPage: StaticPageDefinition<never>;",
            "declare const dynamicPage: ParameterizedPageDefinition<never, 'id'>;",
            "export const routes = Routes.make()",
            ...Array.from({ length: count }, (_, index) =>
              index % 2 === 0
                ? `.page('/route${index}', staticPage)`
                : `.page('/route${index}/:id', dynamicPage)`,
            ),
            ";",
          ].join("\n"),
        );
        const { stdout: diagnostics } = await exec(
          process.execPath,
          [compiler, "--project", join(workspace, "tsconfig.json"), "--extendedDiagnostics"],
          { timeout: compilerTimeout },
        );
        const match = /^Instantiations:\s+(\d+)/mu.exec(diagnostics);
        expect(match, diagnostics).not.toBeNull();
        return Number(match?.[1]);
      };

      const small = await measure(100);
      const large = await measure(400);
      expect(small).toBeGreaterThan(0);
      // Four times the routes allows headroom above linear growth. The old check grew by 11x.
      // Count checker work instead of elapsed time so machine load cannot change the verdict.
      expect(large, `100 routes: ${small}; 400 routes: ${large}`).toBeLessThan(small * 6);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  },
  testTimeout,
);
