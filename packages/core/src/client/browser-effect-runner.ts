import { Context, FiberSet, Layer, Scope } from "effect";
import { HttpClient } from "effect/http";

export class BrowserEffectRunner extends Context.Service<BrowserEffectRunner>()(
  "effront/client/BrowserEffectRunner",
  {
    make: FiberSet.makeRuntimePromise<HttpClient.HttpClient | Scope.Scope>(),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
