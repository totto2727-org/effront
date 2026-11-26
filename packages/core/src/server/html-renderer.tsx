import { Context, Effect, Layer } from "effect";
import type { Scope } from "effect";

import type { FlightPayload } from "#core/rsc/flight.ts";
import type { FlightRender } from "./flight-renderer.tsx";
import { HtmlRenderError } from "./html-render-error.ts";
import type { renderHtml } from "./ssr.tsx";

declare global {
  interface ImportMeta {
    // oxlint-disable-next-line rules/no-readonly -- Vite owns its generated import.meta entry.
    readonly viteRsc: {
      // oxlint-disable-next-line typescript/method-signature-style -- Match Vite's merged ambient method declaration exactly.
      loadModule<T>(environment: string, entry: string): Promise<T>;
    };
  }
}

export type HtmlRenderOptions = Readonly<{
  formState: FlightPayload["formState"];
  signal: AbortSignal;
}>;

export type RenderHtml = (
  stream: ReadableStream<Uint8Array>,
  options: HtmlRenderOptions,
) => Promise<ReadableStream<Uint8Array>>;

export class HtmlRenderer extends Context.Service<HtmlRenderer>()(
  "effront/server/html-renderer/HtmlRenderer",
  {
    make: Effect.succeed({
      render: Effect.fnUntraced(function* ({
        flight,
        formState,
      }: Readonly<{
        flight: FlightRender;
        formState: FlightPayload["formState"];
      }>): Effect.fn.Return<ReadableStream<Uint8Array>, HtmlRenderError, Scope.Scope> {
        const signal = yield* Effect.abortSignal;
        return yield* Effect.tryPromise({
          catch: (cause) => new HtmlRenderError({ cause }),
          try: async () => {
            const ssr = await import.meta.viteRsc.loadModule<{ renderHtml: typeof renderHtml }>(
              "ssr",
              "index",
            );
            return ssr.renderHtml(flight.stream, { formState, signal });
          },
        });
      }),
    }),
  },
) {
  // oxlint-disable-next-line rules/no-readonly -- The service exposes a stable, nonassignable Layer.
  public static readonly layer = Layer.effect(this, this.make);
}
