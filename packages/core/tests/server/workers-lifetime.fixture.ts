import { Context, Effect, Layer } from "effect";

export class RequestLifetime extends Context.Service<
  RequestLifetime,
  Readonly<{ events: string[] }>
>()("effront/tests/workers/RequestLifetime") {}

export const lifetimeLayer = (events: string[]): Layer.Layer<RequestLifetime> =>
  Layer.effect(
    RequestLifetime,
    Effect.acquireRelease(
      Effect.sync(() => {
        events.push("acquired");
        return RequestLifetime.of({ events });
      }),
      () =>
        Effect.sync(() => {
          events.push("released");
        }),
    ),
  );
