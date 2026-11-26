import { Context, Data, Effect, Layer, SubscriptionRef } from "effect";

// oxlint-disable-next-line typescript/no-generated-empty-object-type -- Effect represents payload-free tags with an empty record.
type StatusWithoutPayload = Record<never, never>;

type RenderStatus = Data.TaggedEnum<{
  Failed: { componentStack: string | null; error: unknown };
  Rendered: StatusWithoutPayload;
  Waiting: StatusWithoutPayload;
}>;

export const browserRenderStatuses = Data.taggedEnum<RenderStatus>();

// Replay the latest status: diagnostics may start after hydration has already failed.
export class BrowserRenderStatus extends Context.Service<BrowserRenderStatus>()(
  "effront/client/BrowserRenderStatus",
  {
    make: SubscriptionRef.make<RenderStatus>(browserRenderStatuses.Waiting()).pipe(
      Effect.map((status) => ({
        changes: SubscriptionRef.changes(status),
        get: SubscriptionRef.get(status),
        report: (value: RenderStatus) => SubscriptionRef.set(status, value),
      })),
    ),
  },
) {
  // oxlint-disable-next-line rules/no-readonly -- The layer reference stays fixed for the browser runtime.
  public static readonly layer = Layer.effect(this, this.make);
}
