import type { Page } from "@playwright/test";

declare global {
  var markdownFlightBodies: ReadonlyMap<string, string> | undefined;
}

export const observeMarkdownFlight = async (
  page: Page,
  paths: Readonly<string[]>,
): Promise<void> => {
  await page.addInitScript((trackedPaths) => {
    const nativeFetch = globalThis.fetch;
    const bodies = new Map<string, string>();
    Object.defineProperty(globalThis, "markdownFlightBodies", { value: bodies });
    globalThis.fetch = async (...args) => {
      const response = await nativeFetch(...args);
      const { body, headers, url } = response;
      if (
        !body ||
        headers.get("content-type")?.includes("text/x-component") !== true ||
        !trackedPaths.includes(new URL(url).pathname)
      ) {
        return response;
      }
      const decoder = new TextDecoder();
      const fragments: string[] = [];
      // Record the bytes flowing to the app before Flight releases the transport.
      const observed = body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          flush: () => {
            fragments.push(decoder.decode());
            bodies.set(url, fragments.join(""));
          },
          transform: (chunk, controller) => {
            fragments.push(decoder.decode(chunk, { stream: true }));
            controller.enqueue(chunk);
          },
        }),
      );
      Object.defineProperty(response, "body", { value: observed });
      return response;
    };
  }, paths);
};

export const observedFlightBody = async (page: Page, url: string): Promise<string | undefined> =>
  page.evaluate((address) => globalThis.markdownFlightBodies?.get(address), url);
