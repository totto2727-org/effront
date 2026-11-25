import { describe, expect, test } from "vite-plus/test";
import {
  forbiddenImplicitEntry,
  implicitIndices,
  manifests,
  packManifest,
  synchronizedVersion,
} from "./package-layout.fixture.ts";

const noTargets = 0;
const packageTimeout = 30_000;
const packages = await manifests();

describe("source module layout", () => {
  test("uses responsibility-named TypeScript modules instead of implicit index entries", async () => {
    await expect(implicitIndices()).resolves.toStrictEqual([]);
  });
});

describe("published package layout", () => {
  test.each(packages)(
    "packs every public export of %s at the synchronized release",
    async (manifest) => {
      expect.hasAssertions();
      const expectedVersion = await synchronizedVersion();
      const { files, targets, version } = await packManifest(manifest);
      expect(version).toBe(expectedVersion);
      expect(targets.length).toBeGreaterThan(noTargets);
      targets.forEach((target) => {
        expect(files).toContain(`package/${target.replace(/^\.\//u, "")}`);
        expect(forbiddenImplicitEntry(target)).toBe(false);
      });
      expect(files.filter((file) => /\.(?:test|e2e)\.[cm]?[jt]sx?$/u.test(file))).toStrictEqual([]);
    },
    packageTimeout,
  );
});
