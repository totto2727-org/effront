import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { Schema } from "effect";
import { expect, it } from "vite-plus/test";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const publication = Schema.Struct({ files: Schema.Array(Schema.Struct({ path: Schema.String })) });

it.each([
  { name: "effront", entries: ["index", "unsupported", "workers", "client/entry", "server/ssr"] },
  { name: "vite", entries: ["index", "browser"] },
  { name: "cloudflare", entries: ["index", "workers"] },
  { name: "markdown", entries: ["index"] },
])(
  "$name publishes JavaScript and declarations rather than source or test modules",
  ({ name, entries }) => {
    const output = execFileSync("vp", ["pm", "publish", "--dry-run", "--no-git-checks", "--json"], {
      cwd: join(repository, "packages", name),
      encoding: "utf8",
      timeout: 30_000,
    });
    const files = Schema.decodeUnknownSync(publication)(JSON.parse(output)).files.map(
      (file) => file.path,
    );

    expect(files).toEqual(expect.arrayContaining(["package.json", "LICENSE"]));
    for (const entry of entries) {
      expect(files).toContain(`dist/${entry}.js`);
      expect(files).toContain(`dist/${entry}.d.ts`);
    }
    expect(files.filter((file) => file.startsWith("src/"))).toEqual([]);
    expect(files.filter((file) => /\.tsx?$/.test(file) && !file.endsWith(".d.ts"))).toEqual([]);
    expect(files.filter((file) => /\.test\./.test(file))).toEqual([]);
  },
);
