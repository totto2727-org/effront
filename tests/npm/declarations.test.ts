import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, it } from "vite-plus/test";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const fixture = fileURLToPath(new URL("./fixture/", import.meta.url));
const temporary = fileURLToPath(new URL("../../tmp/", import.meta.url));

const archive = (name: string) => `file:./${name}.tgz`;

const manifest = {
  name: "effront-archive-declaration-consumer",
  packageManager: "pnpm@12.3.4",
  private: true,
  type: "module",
  dependencies: {
    "@effect/platform-browser": "4.0.0-rc.113",
    "@effront/cloudflare": archive("cloudflare"),
    "@effront/markdown": archive("markdown"),
    "@effront/vite": archive("vite"),
    "@types/node": "22.20.2",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    effect: "4.0.0-rc.113",
    effront: archive("effront"),
    react: "19.3.0-canary-1d34f91d-20260909",
    "react-dom": "19.3.0-canary-1d34f91d-20260909",
    typescript: "7.0.2",
    vite: "npm:@voidzero-dev/vite-plus-core@0.3.1",
  },
};

it("typechecks public API usage from isolated packed archives", () => {
  const consumer = mkdtempSync(join(temporary, "npm-declarations-"));
  try {
    // Only the isolated installation test needs archives; production publish packs automatically.
    for (const name of ["effront", "vite", "cloudflare", "markdown"]) {
      execFileSync("vp", ["pm", "pack", "--out", join(consumer, `${name}.tgz`)], {
        cwd: join(repository, "packages", name),
        stdio: "pipe",
        timeout: 30_000,
      });
    }
    cpSync(fixture, consumer, { recursive: true });
    writeFileSync(join(consumer, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    writeFileSync(join(consumer, "pnpm-workspace.yaml"), "packages: []\n");
    execFileSync(
      "vp",
      ["install", "--prefer-offline", "--ignore-scripts", "--no-frozen-lockfile"],
      {
        cwd: consumer,
        stdio: "pipe",
        timeout: 60_000,
      },
    );

    for (const name of ["effront", "@effront/vite", "@effront/cloudflare", "@effront/markdown"]) {
      const installed = realpathSync(join(consumer, "node_modules", name, "package.json"));
      expect(installed.startsWith(`${consumer}${sep}`)).toBe(true);
      expect(installed).toContain(`${sep}node_modules${sep}.pnpm${sep}`);
      expect(installed.startsWith(join(repository, "packages"))).toBe(false);
    }

    const checkedFiles = execFileSync(
      "vp",
      ["exec", "tsc", "--project", "tsconfig.json", "--listFiles"],
      { cwd: consumer, encoding: "utf8", timeout: 30_000 },
    );
    for (const name of ["effront", "vite", "cloudflare", "markdown"]) {
      expect(checkedFiles).not.toContain(join(repository, "packages", name, "src"));
    }
  } finally {
    rmSync(consumer, { force: true, recursive: true });
  }
}, 120_000);
