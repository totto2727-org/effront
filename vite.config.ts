import { generateIgnorePatterns } from "@totto2727/gitignore-patterns";
import { defineConfig } from "vite-plus";

// Regenerate effective exclusions from reachable .gitignore files on every config load.
const ignorePatterns = await generateIgnorePatterns(new URL(".", import.meta.url));

export default defineConfig({
  run: {
    tasks: {
      check: { command: "", dependsOn: ["js:check"] },
      fix: { command: "", dependsOn: ["js:fix"] },
      test: { command: "", dependsOn: ["js:test"] },
      "js:check": { command: "vp check", cache: false },
      "js:fix": { command: "vp check --fix", cache: false },
      "js:test": { command: "vp test run", cache: false },
      "release:pack": {
        command: `set -eu
root="$PWD"
mkdir -p "$root/tmp/npm-publish"
for directory in packages/*; do
  (cd "$directory" && vp pm pack -- --filename "$root/tmp/npm-publish/$(basename "$directory").tgz")
done`,
        cache: false,
      },
      "release:publish": {
        // Bun normalizes catalog/workspace references. npm is only the OIDC upload boundary.
        command: `set -eu
for directory in packages/*; do
  archive="tmp/npm-publish/$(basename "$directory").tgz"
  spec="$(tar -xOf "$archive" package/package.json | node -e 'let input = ""; for await (const chunk of process.stdin) input += chunk; const pkg = JSON.parse(input); console.log(pkg.name + "@" + pkg.version)')"
  if vp info "$spec" version --json > tmp/npm-publish/registry-result.json; then
    echo "Skipping already published $spec"
  elif node -e 'const result = JSON.parse(require("node:fs").readFileSync("tmp/npm-publish/registry-result.json", "utf8")); process.exit(result.error === "No matching version found" ? 0 : 1)'; then
    npm publish "$archive" --provenance --access public --tag latest
  else
    cat tmp/npm-publish/registry-result.json
    exit 1
  fi
done`,
        dependsOn: ["release:pack"],
        cache: false,
      },
    },
  },
  fmt: { ignorePatterns },
  lint: {
    plugins: ["eslint", "typescript", "unicorn", "oxc", "react"],
    // Raw template sources are not a workspace project; their imports resolve in generated projects.
    ignorePatterns: [...ignorePatterns, "packages/create-effront/templates/**"],
    options: { typeAware: true, typeCheck: true },
  },
});
