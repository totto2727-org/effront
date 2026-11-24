import type { Scope } from "effect";
import { Context, FiberSet, Layer } from "effect";
import type { HttpClient } from "effect/http";

export class BrowserEffectRunner extends Context.Service<BrowserEffectRunner>()(
  "effront/client/BrowserEffectRunner",
  {
    make: FiberSet.makeRuntimePromise<HttpClient.HttpClient | Scope.Scope>(),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
