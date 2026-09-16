import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { expect, it } from "vite-plus/test";

const archives = fileURLToPath(new URL("../../tmp/npm/", import.meta.url));

it.each([
  {
    name: "effront",
    entries: ["index", "unsupported", "workers", "client/entry", "server/ssr"],
  },
  { name: "vite", entries: ["index", "browser"] },
  { name: "cloudflare", entries: ["index", "workers"] },
  { name: "markdown", entries: ["index"] },
])(
  "$name ships JavaScript and declarations rather than source or test modules",
  ({ name, entries }) => {
    // w:pack creates these exact archives before the root test task runs.
    const files = execFileSync("tar", ["-tzf", `${archives}${name}.tgz`], {
      encoding: "utf8",
    })
      .trim()
      .split("\n");

    expect(files).toEqual(expect.arrayContaining(["package/package.json", "package/LICENSE"]));
    for (const entry of entries) {
      expect(files).toContain(`package/dist/${entry}.js`);
      expect(files).toContain(`package/dist/${entry}.d.ts`);
    }
    expect(files.filter((file) => file.startsWith("package/src/"))).toEqual([]);
    expect(files.filter((file) => /\.tsx?$/.test(file) && !file.endsWith(".d.ts"))).toEqual([]);
    expect(files.filter((file) => /\.test\./.test(file))).toEqual([]);
  },
);
