import { describe, expect, it } from "vite-plus/test";
import { docsDeployment, docsHostname, docsStack, productionStage } from "./deployment";

describe("documentation deployment", () => {
  it("keeps the existing production stack and stage", () => {
    expect({ stack: docsStack, stage: productionStage, hostname: docsHostname }).toEqual({
      stack: "effront-docs",
      stage: "production",
      hostname: "effront.totto2727.dev",
    });
    expect(docsDeployment(productionStage)).toEqual({ kind: "production" });
  });

  it.each(["pr-1", "pr-25", "pr-1234"])("gives %s a stable preview identity", (stage) => {
    expect(docsDeployment(stage)).toEqual({ kind: "preview", name: stage });
  });

  it.each(["dev_totto2727", "dev_ci", "preview-old-branch", "feature/docs"])(
    "does not attach a production domain or parent in %s",
    (stage) => {
      expect(docsDeployment(stage)).toEqual({ kind: "development" });
    },
  );

  it.each(["pr-", "pr-0", "pr-01", "pr--1", "pr-25/production", "pr-production"])(
    "rejects malformed PR identity %s instead of deploying a different Worker",
    (stage) => {
      expect(() => docsDeployment(stage)).toThrow(
        new TypeError(`Invalid documentation preview stage: ${stage}`),
      );
    },
  );
});
