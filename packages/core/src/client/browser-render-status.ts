import { Context, Effect, Layer, SubscriptionRef } from "effect";

type RenderStatus =
  | Readonly<{ _tag: "Waiting" }>
  | Readonly<{ _tag: "Rendered" }>
  | Readonly<{ _tag: "Failed"; error: unknown; componentStack: string | null }>;

// Replay the latest status: diagnostics may start after hydration has already failed.
export class BrowserRenderStatus extends Context.Service<BrowserRenderStatus>()(
  "effront/client/BrowserRenderStatus",
  {
    make: SubscriptionRef.make<RenderStatus>({ _tag: "Waiting" }).pipe(
      Effect.map((status) => ({
        changes: SubscriptionRef.changes(status),
        get: SubscriptionRef.get(status),
        report: (value: RenderStatus) => SubscriptionRef.set(status, value),
      })),
    ),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
