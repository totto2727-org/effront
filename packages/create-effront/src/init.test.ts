import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, expect, test, vi } from "vitest";
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { Command } from "effect/cli";
import packageJson from "../package.json" with { type: "json" };
import vitePlusPackage from "vite-plus/package.json" with { type: "json" };
import workspace from "../../../package.json" with { type: "json" };
import { command } from "./cli.ts";
import { createProject, platforms, projectName } from "./init.ts";

const directories: string[] = [];
const runCommand = Command.runWith(command, { version: packageJson.version });
const runFile = promisify(execFile);

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

const toolchainOverrides = `overrides:\n  "vite@*": npm:@voidzero-dev/vite-plus-core@${vitePlusPackage.version}\n  "vitest@*": ${vitePlusPackage.dependencies.vitest}`;

async function expectPnpmConfiguration(directory: string, platform?: string): Promise<void> {
  const configuration = await readFile(join(directory, "pnpm-workspace.yaml"), "utf8");
  expect(configuration.replaceAll("'", '"')).toContain(toolchainOverrides);
  expect(configuration).not.toMatch(/^minimumReleaseAge/mu);
  expect(configuration.split("allowBuilds:\n")[1]).toBe(
    `${platform ? "" : "  bun: true\n"}  esbuild: true\n${!platform || platform.includes("cloudflare") ? "  workerd: true\n" : ""}`,
  );
}

test("keeps required Vite+ overrides and lifecycle policy aligned with its installed toolchain", async () => {
  await expectPnpmConfiguration(fileURLToPath(new URL("../../../", import.meta.url)));
});

test("ships pnpm toolchain metadata through the published CLI for every platform", async () => {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  await mkdir(join(root, "tmp"), { recursive: true });
  const directory = await mkdtemp(join(root, "tmp", "create-effront-publication-"));
  directories.push(directory);
  const archive = join(directory, "create-effront.tgz");
  await runFile("vp", ["pm", "pack", "--out", archive], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
  });
  await runFile("tar", ["-xf", archive, "-C", directory]);
  // Reuse the installed declared dependencies without another registry installation.
  await symlink(
    fileURLToPath(new URL("../node_modules", import.meta.url)),
    join(directory, "package", "node_modules"),
    "dir",
  );
  const published = JSON.parse(await readFile(join(directory, "package", "package.json"), "utf8"));
  for (const platform of platforms) {
    const project = join(directory, "generated", platform);
    await runFile(process.execPath, [
      join(directory, "package", published.bin["create-effront"]),
      project,
      "--platform",
      platform,
    ]);
    await expect(readdir(project)).resolves.not.toContain("bunfig.toml");
    const manifest = JSON.parse(await readFile(join(project, "package.json"), "utf8"));
    expect(manifest.packageManager).toBe(workspace.packageManager);
    expect(manifest).not.toHaveProperty("overrides");
    expect(manifest).not.toHaveProperty("trustedDependencies");
    await expectPnpmConfiguration(project, platform);
    if (platform === "alchemy-cloudflare") {
      const worker = await readFile(join(project, "src/entry.workers.ts"), "utf8");
      expect(worker).toContain('from "@effront/alchemy/cloudflare/application"');
      expect(worker).toContain('import type application from "./entry.effront.tsx"');
      expect(worker).toContain("makeApplicationHttpEffect<typeof application>()");
      expect(worker).not.toContain("import(");
    }
  }
}, 30_000);

for (const platform of platforms) {
  test(`creates a ${platform} project with the shared application`, async () => {
    const directory = join(await temporaryDirectory(), "My App");
    await createProject(directory, platform);
    const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
    const application = await readFile(join(directory, "src/entry.effront.tsx"), "utf8");
    const examples = ["node", "bun", "cloudflare", "alchemy-cloudflare"];

    expect(manifest.name).toBe("my-app");
    expect(manifest.packageManager).toBe(workspace.packageManager);
    expect(manifest).not.toHaveProperty("overrides");
    expect(manifest).not.toHaveProperty("trustedDependencies");
    await expectPnpmConfiguration(directory, platform);
    await expect(readdir(directory)).resolves.not.toContain("bunfig.toml");
    if (platform === "alchemy-cloudflare") {
      expect(manifest.scripts).toStrictEqual({ dev: "alchemy dev" });
    } else {
      expect(manifest.scripts).not.toHaveProperty("dev");
      expect(manifest.scripts).not.toHaveProperty("build");
    }
    expect(JSON.stringify(manifest)).not.toMatch(/workspace:|catalog:/u);
    expect(manifest.devDependencies).toHaveProperty("vite-plus", "^1.1.0");
    expect(manifest.devDependencies).toHaveProperty("@totto2727/gitignore-patterns", "^0.1.0");
    expect(manifest.devDependencies).toHaveProperty("@totto2727/oxlint", "^0.2.0");
    const config = await readFile(join(directory, "vite.config.ts"), "utf8");
    expect(config).toContain(
      'import { generateIgnorePatterns } from "@totto2727/gitignore-patterns"',
    );
    expect(config).toContain('await generateIgnorePatterns(new URL(".", import.meta.url))');
    expect(config).toContain("fmt: { ignorePatterns }");
    expect(config).toContain("lint: createLintConfig(ignorePatterns)");
    if (platform === "node" || platform === "bun") {
      expect(manifest.scripts.start).toBe(`${platform} dist/rsc/server.js`);
    }
    for (const dependencies of [manifest.dependencies, manifest.devDependencies]) {
      for (const [name, version] of Object.entries(dependencies ?? {})) {
        expect(version).toMatch(/^\^/u);
        if (name.startsWith("@effront/")) {
          expect(version).toBe(`^${packageJson.version}`);
        }
        if (name === "effect" || name.startsWith("@effect/")) {
          expect(version).toBe("^4.0.2");
        }
      }
    }
    for (const example of examples) {
      const source = await readFile(
        new URL(`../../../examples/${example}/src/entry.effront.tsx`, import.meta.url),
        "utf8",
      );
      expect(application).toBe(source);
    }
    await expect(readdir(join(directory, "src"))).resolves.toContain("entry.effront.tsx");
    await expect(readFile(join(directory, ".gitignore"), "utf8")).resolves.toContain(
      "node_modules/",
    );
  });
}

test.each(platforms)(
  "lints the generated %s project with application tracing",
  async (platform) => {
    const root = fileURLToPath(new URL("../../../", import.meta.url));
    await mkdir(join(root, "tmp"), { recursive: true });
    const directory = await mkdtemp(join(root, "tmp", "create-effront-lint-"));
    directories.push(directory);
    const project = await createProject(join(directory, platform), platform);
    // Use the already-built platform dependencies. CI does not install each starter from npm.
    await symlink(join(root, "examples", platform, "node_modules"), join(project, "node_modules"));
    // Give the project its own ignore scope instead of inheriting the workspace's tmp exclusion.
    await runFile("git", ["init", "--quiet"], { cwd: project });

    const lint = () => runFile("vp", ["lint", "--format", "json"], { cwd: project });
    const clean = await lint();
    expect(JSON.parse(clean.stdout)).toMatchObject({
      diagnostics: [],
      number_of_files: platform === "cloudflare" ? 4 : 5,
    });

    await writeFile(
      join(project, "src", "tracing-probe.ts"),
      'import { Effect } from "effect";\nexport const probe = Effect.fnUntraced(() => Effect.void);\n',
    );
    await expect(lint()).rejects.toMatchObject({
      code: 1,
      stdout: expect.stringContaining("rules(effect-tracing)"),
    });
  },
  30_000,
);

for (const platform of platforms) {
  test(`keeps generated ${platform} host entries aligned with the runnable example`, async () => {
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
      let generated = await readFile(join(directory, file), "utf8");
      if (file === "vite.config.ts") {
        // Only standalone check wiring differs from the runnable workspace host configuration.
        generated = generated
          .replace('import { generateIgnorePatterns } from "@totto2727/gitignore-patterns";\n', "")
          .replace('import { createLintConfig } from "./lint.config.ts";\n', "")
          .replace(
            '\nconst ignorePatterns = await generateIgnorePatterns(new URL(".", import.meta.url));\n',
            "",
          )
          .replace(
            "// oxlint-disable-next-line import/no-default-export -- Vite loads its configuration from a default export.\n",
            "",
          )
          .replace("  fmt: { ignorePatterns },\n  lint: createLintConfig(ignorePatterns),\n", "");
      }
      expect(generated).toBe(
        await readFile(new URL(`../../../examples/${platform}/${file}`, import.meta.url), "utf8"),
      );
    }
  });
}

test("creates a standalone Cloudflare Worker without Alchemy or bindings", async () => {
  const directory = join(await temporaryDirectory(), "cloudflare");
  await createProject(directory, "cloudflare");
  const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
  const worker = await readFile(join(directory, "src/entry.workers.ts"), "utf8");
  const config = await readFile(join(directory, "vite.config.ts"), "utf8");
  const wrangler = JSON.parse(await readFile(join(directory, "wrangler.json"), "utf8"));
  expect(manifest.dependencies).toHaveProperty("@effront/cloudflare", `^${packageJson.version}`);
  expect(manifest.dependencies).not.toHaveProperty("@effront/alchemy");
  expect(manifest.dependencies).not.toHaveProperty("alchemy");
  expect(manifest.dependencies).not.toHaveProperty("@effront/server");
  expect(manifest.devDependencies).toHaveProperty("wrangler", "^4.148.0");
  expect(manifest.scripts).toStrictEqual({ deploy: "wrangler deploy" });
  expect(worker).toContain("createFetchHandler(application)");
  expect(config).toContain("effrontCloudflare()");
  expect(config).not.toContain("server:");
  expect(wrangler).toMatchObject({ name: "cloudflare", main: "src/entry.workers.ts" });
  expect(wrangler).not.toHaveProperty("vars");
  expect(wrangler).not.toHaveProperty("assets");
  await expect(readdir(directory)).resolves.not.toContain("alchemy.run.ts");
  await expect(readdir(join(directory, "src"))).resolves.not.toContain("entry.server.ts");
});

test("keeps standalone Cloudflare hosting out of the Alchemy project", async () => {
  const directory = join(await temporaryDirectory(), "alchemy-cloudflare");
  await createProject(directory, "alchemy-cloudflare");
  const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
  const worker = await readFile(join(directory, "src/entry.workers.ts"), "utf8");
  const config = await readFile(join(directory, "vite.config.ts"), "utf8");
  const runner = await readFile(join(directory, "alchemy.run.ts"), "utf8");
  expect(manifest.dependencies).toHaveProperty("@effront/alchemy", `^${packageJson.version}`);
  expect(manifest.dependencies).not.toHaveProperty("@effront/cloudflare");
  expect(manifest.dependencies).not.toHaveProperty("@effront/server");
  expect(worker).toContain("makeApplicationHttpEffect");
  expect(config).toContain("effrontAlchemy()");
  expect(config).not.toContain("server:");
  expect(runner).toContain('"alchemy-cloudflare"');
  expect(worker).not.toContain("dev: { port:");
  await expect(readdir(directory)).resolves.not.toContain("wrangler.json");
  await expect(readdir(join(directory, "src"))).resolves.not.toContain("entry.server.ts");
});

for (const platform of ["node", "bun"] as const) {
  test(`uses Vite defaults and optional host environment settings for ${platform}`, async () => {
    const directory = join(await temporaryDirectory(), platform);
    await createProject(directory, platform);
    const config = await readFile(join(directory, "vite.config.ts"), "utf8");
    const server = await readFile(join(directory, "src/entry.server.ts"), "utf8");
    expect(config).not.toContain("server:");
    expect(server).toContain('PORT: port = ""');
    expect(server).toContain('HOST: hostname = ""');
    expect(server).toContain("...(String.isNonEmpty(port) ? { port: Number(port) } : {})");
    expect(server).toContain("...(String.isNonEmpty(hostname) ? { hostname } : {})");
    expect(server).not.toContain("port: undefined");
    expect(server).not.toMatch(/1340|1343|127\.0\.0\.1/u);
  });
}

for (const platform of platforms) {
  test(`accepts the ${platform} flag forwarded by vp create`, async () => {
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

test("describes supported platforms in framework-generated help", async () => {
  const output = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    await Effect.runPromise(runCommand(["--help"]).pipe(Effect.provide(NodeServices.layer)));
    expect(output).toHaveBeenCalledWith(expect.stringContaining("--platform"));
    expect(output).toHaveBeenCalledWith(expect.stringContaining("alchemy-cloudflare"));
  } finally {
    output.mockRestore();
  }
});

test("creates a project from forwarded VitePlus arguments and recommends vp commands", async () => {
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

test("refuses to overwrite an existing project", async () => {
  const directory = await temporaryDirectory();
  await writeFile(join(directory, "keep.txt"), "preserve me");
  await expect(createProject(directory, "node")).rejects.toThrow("not empty");
  await expect(readFile(join(directory, "keep.txt"), "utf8")).resolves.toBe("preserve me");
  await expect(readdir(directory)).resolves.toStrictEqual(["keep.txt"]);
});

test("validates the normalized project name before touching the target", async () => {
  const directory = await temporaryDirectory();
  expect(projectName(join(directory, "My 🧪 App"))).toBe("my-app");
  await expect(createProject(join(directory, "🧪"), "node")).rejects.toThrow(
    "Project directory must contain letters or numbers.",
  );
  expect(await readdir(directory)).toStrictEqual([]);
});

test("rejects invalid platform and unexpected options without creating a project", async () => {
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

test("rejects missing options without a terminal", async () => {
  await expect(
    Effect.runPromise(runCommand([]).pipe(Effect.provide(NodeServices.layer))),
  ).rejects.toThrow("Specify a directory and --platform in non-interactive mode.");
});

test("recommends Alchemy orchestration rather than a direct Vite dev command", async () => {
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
