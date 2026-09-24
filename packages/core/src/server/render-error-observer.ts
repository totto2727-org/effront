import { Context } from "effect";

/**
 * Optional notification for host policies that must reject errored renders.
 *
 * React can encode an error in a successful HTTP stream. Renderers capture this
 * request-local callback before streaming and invoke it synchronously on errors.
 * The callback must not throw and should be idempotent. It is never serialized.
 */
export const RenderErrorObserver = Context.Reference<(() => void) | undefined>(
  "effront/http/RenderErrorObserver",
  { defaultValue: () => undefined },
);
