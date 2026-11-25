import { expect, test as base } from "@playwright/test";
import type { Page } from "@playwright/test";
import { Data, Predicate, String } from "effect";

class LocalLayoutHostMissing extends Data.TaggedError("LocalLayoutHostMissing")<{
  message: string;
}> {}

const getOrigin = (baseURL: string | undefined): string => {
  if (Predicate.isNullish(baseURL) || String.isEmpty(baseURL)) {
    throw new LocalLayoutHostMissing({ message: "Docs acceptance requires a local host baseURL" });
  }
  return new URL(baseURL).origin;
};

type BrowserFaults = Readonly<{
  hydrationErrors: string[];
  pageErrors: string[];
  remoteRequests: string[];
}>;

const observeBrowserFaults = async (page: Page, origin: string): Promise<BrowserFaults> => {
  const hydrationErrors: string[] = [];
  const pageErrors: string[] = [];
  const remoteRequests: string[] = [];
  // External reference anchors are allowed. The browser must navigate and render locally.
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (/^https?:$/u.test(url.protocol) && url.origin !== origin) {
      remoteRequests.push(url.href);
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (/hydrat|server rendered html|did not match/iu.test(message.text())) {
      hydrationErrors.push(message.text());
    }
  });
  return { hydrationErrors, pageErrors, remoteRequests };
};

const expectNoBrowserFaults = (faults: BrowserFaults): void => {
  expect(faults.pageErrors, "Uncaught browser errors").toEqual([]);
  expect(faults.hydrationErrors, "React hydration faults").toEqual([]);
  expect(
    faults.remoteRequests.filter((url) => !url.startsWith("https://fonts.googleapis.com/")),
    "Only upstream Mermaid's Google Fonts import may be blocked by local acceptance policy",
  ).toEqual([]);
};

export const docsTest = base.extend({
  page: async ({ page, baseURL }, runWithPage) => {
    const faults = await observeBrowserFaults(page, getOrigin(baseURL));
    await runWithPage(page);
    expectNoBrowserFaults(faults);
  },
});
