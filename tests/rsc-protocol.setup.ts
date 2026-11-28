import { vi } from "vite-plus/test";

// The RSC plugin is a core dependency, not a workspace-root dependency.
const { rscServer } = await vi.hoisted(async () => {
  const { createRequire } = await import("node:module");
  const require = createRequire(new URL("../packages/core/package.json", import.meta.url));
  return { rscServer: require.resolve("@vitejs/plugin-rsc/rsc/server") };
});

// Default Vitest suites run outside the Vite RSC graph. Actual serialization belongs to host E2E.
vi.mock(rscServer, () => {
  const unexpected = (): never => {
    throw new Error("An HTTP-only test unexpectedly invoked the RSC protocol.");
  };
  return {
    createTemporaryReferenceSet: unexpected,
    decodeAction: unexpected,
    decodeFormState: unexpected,
    decodeReply: unexpected,
    loadServerAction: unexpected,
    renderToReadableStream: unexpected,
  };
});
