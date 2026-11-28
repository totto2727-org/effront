import { localState, Stack } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { Backoffice, backoffice, Storefront, storefront } from "./src/entry.workers";

export default Stack(
  "effront-multi-worker",
  { state: localState(), providers: Cloudflare.providers() },
  Effect.gen(function* () {
    const [shop, office] = yield* Effect.all([
      Storefront.pipe(Effect.provide(storefront)),
      Backoffice.pipe(Effect.provide(backoffice)),
    ]);
    return { storefront: shop.url, backoffice: office.url };
  }),
);
