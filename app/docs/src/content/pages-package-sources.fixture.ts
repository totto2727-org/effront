import { Array, Option, Record, Schema, String } from "effect";

const packageManifests = import.meta.glob<string>("../../../../packages/*/package.json", {
  eager: true,
  import: "default",
  query: "?raw",
});
const packageReadmes = import.meta.glob<string>("../../../../packages/*/README.md", {
  eager: true,
  import: "default",
  query: "?raw",
});
const articles = import.meta.glob<string>("./{articles,en/articles}/**/*.md", {
  eager: true,
  import: "default",
  query: "?raw",
});
const rootReadme = import.meta.glob<string>("../../../../README.md", {
  eager: true,
  import: "default",
  query: "?raw",
});

const manifestSuffix = "/package.json";
const startOfPath = 0;
const rootExport = ".";
const manifestSchema = Schema.Struct({
  exports: Schema.Record(Schema.String, Schema.Unknown),
  name: Schema.String,
});
const manifest = Schema.decodeUnknownOption(manifestSchema);

const packageRoot = (filename: string): string =>
  filename.slice(startOfPath, -manifestSuffix.length);
const hasPublicExport = (subpath: string): boolean =>
  !subpath.includes("/internal/") && !subpath.endsWith(".css");

const publicExports = (source: string): string[] => {
  const parsed: unknown = JSON.parse(source);
  const metadata = Option.getOrThrow(manifest(parsed));
  const exported = Array.filter(Record.keys(metadata.exports), (subpath) =>
    hasPublicExport(subpath),
  );
  return Array.map(exported, (subpath) =>
    subpath === rootExport ? metadata.name : `${metadata.name}${subpath.slice(rootExport.length)}`,
  );
};

const contentPackages = Array.filter(
  Record.keys(packageManifests),
  (filename) => !String.endsWith("/create-effront/package.json")(filename),
);

export const packageExportNames = Array.flatMap(contentPackages, (filename) =>
  publicExports(packageManifests[filename] ?? ""),
);
export const expectedReadmes = Array.map(
  Record.keys(packageManifests),
  (filename) => `${packageRoot(filename)}/README.md`,
);
export const missingReadmes = Array.filter(
  expectedReadmes,
  (filename) => !Object.hasOwn(packageReadmes, filename),
);

const commandPattern = /(?:vp add|npm install|pnpm add|bun add|yarn add)\b[^`\n]*/gu;
const pinnedPackage = /(?:@[a-z\d._-]+\/)?[a-z\d._-]+@[^\s'"]+/iu;

export const installationExamples = (): Readonly<{ commands: string[]; pinned: string[] }> => {
  const documents = [
    ...Record.values(articles),
    ...Record.values(rootReadme),
    ...Record.values(packageReadmes),
  ];
  const commands = Array.flatMap(documents, (source) => source.match(commandPattern) ?? []);
  return { commands, pinned: Array.filter(commands, (command) => pinnedPackage.test(command)) };
};
