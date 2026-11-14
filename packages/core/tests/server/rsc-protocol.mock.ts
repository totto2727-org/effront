import { vi } from "vite-plus/test";

// HTTP-only tests do not run a Vite RSC environment. Actual serialization belongs to host E2E.
vi.mock("@vitejs/plugin-rsc/rsc/server", () => {
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
