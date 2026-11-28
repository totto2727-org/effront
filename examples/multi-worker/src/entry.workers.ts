import { effrontWorkerOptions } from "@effront/alchemy/cloudflare";
import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare/application";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { HttpServerResponse } from "effect/http";
import type backofficeApplication from "./backoffice";
import type storefrontApplication from "./storefront";

export class Storefront extends Cloudflare.Worker<Storefront, Cloudflare.WorkerShape>()(
  "Storefront",
) {}
export class Backoffice extends Cloudflare.Worker<Backoffice, Cloudflare.WorkerShape>()(
  "Backoffice",
) {}

export const storefront = Storefront.make(
  {
    main: import.meta.url,
    compatibility: { date: "2026-09-01" },
    ...effrontWorkerOptions("storefront"),
  },
  Effect.gen(function* () {
    const fetch = yield* makeApplicationHttpEffect<typeof storefrontApplication>();
    return {
      fetch: fetch.pipe(
        Effect.map(HttpServerResponse.setHeader("x-worker", "storefront")),
        Effect.orDie,
      ),
    };
  }),
);

export const backoffice = Backoffice.make(
  {
    main: import.meta.url,
    compatibility: { date: "2026-09-01" },
    ...effrontWorkerOptions("backoffice"),
  },
  Effect.gen(function* () {
    const fetch = yield* makeApplicationHttpEffect<typeof backofficeApplication>();
    return {
      fetch: fetch.pipe(
        Effect.map(HttpServerResponse.setHeader("x-worker", "backoffice")),
        Effect.orDie,
      ),
    };
  }),
);
