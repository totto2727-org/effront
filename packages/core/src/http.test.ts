import { describe, expect, it } from "@effect/vitest";
import { Context, Effect, Layer, Scope, Stream } from "effect";
import {
  HttpEffect,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";

import { Application } from "./application/effront";
import type { ApplicationRequirements, ApplicationServices } from "./application/definition";
import { getApplicationState } from "./application/definition";
import { makeHttpEffect, toHttpEffect } from "./http";

class External extends Context.Service<External, { readonly label: string }>()(
  "effront/test/http/External",
) {}
class RequestResource extends Context.Service<RequestResource, { readonly label: string }>()(
  "effront/test/http/RequestResource",
) {}

const encoder = new TextEncoder();
type Acquisition = {
  readonly label: string;
  readonly scope: Scope.Scope;
  released: number;
};

const makeProbeApplication = (
  acquisitions: Array<Acquisition>,
  respond: (acquisition: Acquisition) => Effect.Effect<HttpServerResponse.HttpServerResponse> = (
    acquisition,
  ) =>
    Effect.succeed(
      HttpServerResponse.stream(
        Stream.make(encoder.encode(acquisition.label)).pipe(Stream.concat(Stream.never)),
      ),
    ),
) => {
  const EFFRONT = Application.effront<RequestResource>();
  const Shell = EFFRONT.Layout.make({ render: ({ children }) => Effect.succeed(children) });
  const Page = EFFRONT.Page.make({ render: () => Effect.succeed(null) });
  const layer = Layer.effect(
    RequestResource,
    Effect.gen(function* () {
      const external = yield* External;
      const request = yield* HttpServerRequest.HttpServerRequest;
      const scope = yield* Effect.scope;
      const acquisition: Acquisition = {
        label: `${external.label}:${request.headers["x-request-id"]}`,
        scope,
        released: 0,
      };
      acquisitions.push(acquisition);
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          acquisition.released++;
        }),
      );
      const router = yield* HttpRouter.HttpRouter;
      yield* router.add("GET", "/probe", respond(acquisition));
      return { label: acquisition.label };
    }),
  );
  return EFFRONT.make({ routes: EFFRONT.Routes.make({ layout: Shell }).page("/", Page), layer });
};

const request = (id: string, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  headers.set("x-request-id", id);
  return new Request("https://example.test/probe", { ...init, headers });
};

const capture = (application: ReturnType<typeof makeProbeApplication>) =>
  Effect.runPromise(
    Effect.scoped(
      makeHttpEffect(application).pipe(
        Effect.provideService(External, { label: "captured" }),
        Effect.provideService(
          HttpServerRequest.HttpServerRequest,
          HttpServerRequest.fromWeb(request("stale")),
        ),
      ),
    ),
  );

describe("native HTTP effects", () => {
  it.each(["captured", "ambient"] as const)(
    "isolates request acquisition from a primed construction memo map (%s)",
    async (mode) => {
      const acquisitions: Array<Acquisition> = [];
      const application = makeProbeApplication(acquisitions);
      const memoMap = Layer.makeMemoMapUnsafe();
      await Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            yield* Layer.buildWithMemoMap(
              getApplicationState(application).layer.pipe(Layer.provide(HttpRouter.layer)),
              memoMap,
              yield* Effect.scope,
            );
            expect(acquisitions.map((value) => value.label)).toEqual(["host:construction"]);
            const httpEffect =
              mode === "captured" ? yield* makeHttpEffect(application) : toHttpEffect(application);
            const handler = HttpEffect.toWebHandlerWith<never, Effect.Services<typeof httpEffect>>(
              Context.empty(),
            )(httpEffect);
            const live = Context.make(External, { label: "host" }).pipe(
              Context.add(Layer.CurrentMemoMap, memoMap),
            );
            const first = yield* Effect.promise(() => handler(request("one"), live));
            const second = yield* Effect.promise(() => handler(request("two"), live));
            expect(first.status).toBe(200);
            expect(second.status).toBe(200);
            expect(acquisitions.map((value) => value.label)).toEqual([
              "host:construction",
              "host:one",
              "host:two",
            ]);
            yield* Effect.promise(() => first.body!.cancel());
            expect(acquisitions.map((value) => value.released)).toEqual([0, 1, 0]);
            yield* Effect.promise(() => second.body!.cancel());
            expect(acquisitions.map((value) => value.released)).toEqual([0, 1, 1]);
          }).pipe(
            Effect.provideService(External, { label: "host" }),
            Effect.provideService(
              HttpServerRequest.HttpServerRequest,
              HttpServerRequest.fromWeb(request("construction")),
            ),
            Effect.provideService(Layer.CurrentMemoMap, memoMap),
          ),
        ),
      );
      expect(acquisitions.map((value) => value.released)).toEqual([1, 1, 1]);
    },
  );

  it("preserves application services and external requirements at the type boundary", () => {
    const application = makeProbeApplication([]);
    const services: ApplicationServices<typeof application> = RequestResource;
    const external: ApplicationRequirements<typeof application> = External;
    expect(services).toBe(RequestResource);
    expect(external).toBe(External);
    const checkTypes = () => {
      // @ts-expect-error External is required while constructing the captured handler.
      void Effect.runPromise(makeHttpEffect(application));
      // @ts-expect-error An ambient handler retains the external service requirement.
      HttpEffect.toWebHandler(toHttpEffect(application));
    };
    expect(checkTypes).toBeTypeOf("function");
  });

  it("captures external services without building request layers or retaining a closed construction scope", async () => {
    const acquisitions: Array<Acquisition> = [];
    const handler = HttpEffect.toWebHandler(await capture(makeProbeApplication(acquisitions)));
    expect(acquisitions).toEqual([]);
    const response = await handler(request("first"));
    const acquisition = acquisitions[0]!;
    expect(acquisition.label).toBe("captured:first");
    expect(acquisition.released).toBe(0);
    await response.body!.cancel();
    expect(acquisition.released).toBe(1);
  });

  it("uses current external context with an ambient handler and isolates concurrent request scopes", async () => {
    const acquisitions: Array<Acquisition> = [];
    const httpEffect = toHttpEffect(makeProbeApplication(acquisitions));
    const handler = HttpEffect.toWebHandlerWith<never, Effect.Services<typeof httpEffect>>(
      Context.empty(),
    )(httpEffect);
    const [first, second] = await Promise.all([
      handler(request("one"), Context.make(External, { label: "A" })),
      handler(request("two"), Context.make(External, { label: "B" })),
    ]);
    expect(acquisitions.map((value) => value.label).sort()).toEqual(["A:one", "B:two"]);
    expect(acquisitions[0]!.scope).not.toBe(acquisitions[1]!.scope);
    expect(acquisitions.map((value) => value.released)).toEqual([0, 0]);
    await first.body!.cancel();
    await second.body!.cancel();
    expect(acquisitions.map((value) => value.released)).toEqual([1, 1]);
  });

  it("lets live external services override captured service references", async () => {
    const acquisitions: Array<Acquisition> = [];
    const handler = HttpEffect.toWebHandler(await capture(makeProbeApplication(acquisitions)));
    const response = await handler(request("live"), Context.make(External, { label: "override" }));
    expect(acquisitions[0]!.label).toBe("override:live");
    await response.body!.cancel();
  });

  it("keeps acquired resources alive while delayed stream chunks run and closes them at EOF", async () => {
    const acquisitions: Array<Acquisition> = [];
    const app = makeProbeApplication(acquisitions, (acquisition) =>
      Effect.succeed(
        HttpServerResponse.stream(
          Stream.fromEffect(
            Effect.sync(() => {
              expect(acquisition.released).toBe(0);
              return encoder.encode(acquisition.label);
            }),
          ),
        ),
      ),
    );
    const response = await HttpEffect.toWebHandler(await capture(app))(request("eof"));
    expect(await response.text()).toBe("captured:eof");
    expect(acquisitions[0]!.released).toBe(1);
  });

  it("closes request resources when the body stream fails", async () => {
    const acquisitions: Array<Acquisition> = [];
    const app = makeProbeApplication(acquisitions, () =>
      Effect.succeed(HttpServerResponse.stream(Stream.fail(new Error("body failed")))),
    );
    const response = await HttpEffect.toWebHandler(await capture(app))(request("error"));
    await expect(response.text()).rejects.toThrow("body failed");
    expect(acquisitions[0]!.released).toBe(1);
  });

  it("closes request resources for HEAD and non-stream responses", async () => {
    const acquisitions: Array<Acquisition> = [];
    const head = await HttpEffect.toWebHandler(await capture(makeProbeApplication(acquisitions)))(
      request("head", { method: "HEAD" }),
    );
    expect(head.body).toBeNull();
    await expect.poll(() => acquisitions[0]!.released).toBe(1);
    const app = makeProbeApplication(acquisitions, () =>
      Effect.succeed(HttpServerResponse.empty()),
    );
    await HttpEffect.toWebHandler(await capture(app))(request("empty"));
    await expect.poll(() => acquisitions[1]!.released).toBe(1);
  });

  it("rejects oversized requests before acquiring application services", async () => {
    const acquisitions: Array<Acquisition> = [];
    const handler = HttpEffect.toWebHandler(await capture(makeProbeApplication(acquisitions)));
    const response = await handler(
      request("oversize", { headers: { "content-length": String(10 * 1024 * 1024 + 1) } }),
    );
    expect(response.status).toBe(413);
    expect(acquisitions).toEqual([]);
  });

  it("does not dispose host-owned external services when a request finishes", async () => {
    let externalReleased = 0;
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const external = yield* Effect.acquireRelease(Effect.succeed({ label: "host" }), () =>
            Effect.sync(() => {
              externalReleased++;
            }),
          );
          const acquisitions: Array<Acquisition> = [];
          const httpEffect = yield* makeHttpEffect(makeProbeApplication(acquisitions)).pipe(
            Effect.provideService(External, external),
          );
          const response = yield* Effect.promise(() =>
            HttpEffect.toWebHandler(httpEffect)(request("owned")),
          );
          yield* Effect.promise(() => response.body!.cancel());
          expect(acquisitions[0]!.released).toBe(1);
          expect(externalReleased).toBe(0);
        }),
      ),
    );
    expect(externalReleased).toBe(1);
  });

  it("interrupts pending request work and releases its application resources on client abort", async () => {
    const acquisitions: Array<Acquisition> = [];
    let interrupted = false;
    const app = makeProbeApplication(acquisitions, () =>
      Effect.never.pipe(
        Effect.onInterrupt(() =>
          Effect.sync(() => {
            interrupted = true;
          }),
        ),
      ),
    );
    const controller = new AbortController();
    const response = HttpEffect.toWebHandler(await capture(app))(
      request("abort", { signal: controller.signal }),
    );
    await expect.poll(() => acquisitions.length).toBe(1);
    controller.abort();
    await response;
    await expect.poll(() => acquisitions[0]!.released).toBe(1);
    expect(interrupted).toBe(true);
  });

  it("preserves streamed GET metadata when normalizing a HEAD response", async () => {
    const acquisitions: Array<Acquisition> = [];
    const app = makeProbeApplication(acquisitions, () =>
      Effect.succeed(
        HttpServerResponse.stream(Stream.never, {
          status: 202,
          contentType: "text/custom",
          contentLength: 123,
          headers: { "x-result": "head" },
        }),
      ),
    );
    const response = await HttpEffect.toWebHandler(await capture(app))(
      request("head", { method: "HEAD" }),
    );
    expect(response.status).toBe(202);
    expect(response.headers.get("content-type")).toBe("text/custom");
    expect(response.headers.get("content-length")).toBe("123");
    expect(response.headers.get("x-result")).toBe("head");
    expect(response.body).toBeNull();
    await expect.poll(() => acquisitions[0]!.released).toBe(1);
  });

  it("forwards an external service into application middleware without constructing another instance", async () => {
    const EFFRONT = Application.effront<External>();
    const shell = EFFRONT.Layout.make({ render: ({ children }) => Effect.succeed(children) });
    const page = EFFRONT.Page.make({ render: () => Effect.succeed(null) });
    const external = { label: "direct" };
    const middleware = EFFRONT.Middleware.make(() =>
      Effect.gen(function* () {
        const service = yield* External;
        expect(service).toBe(external);
        return HttpServerResponse.text(service.label);
      }),
    );
    const app = EFFRONT.make({
      layer: Layer.effect(External, External),
      routes: EFFRONT.withMiddleware(middleware)
        .Routes.make({ layout: shell })
        .page("/probe", page),
    });
    const httpEffect = await Effect.runPromise(
      makeHttpEffect(app).pipe(Effect.provideService(External, external)),
    );
    const response = await HttpEffect.toWebHandler(httpEffect)(request("forwarded"));
    expect(await response.text()).toBe("direct");
  });

  it("preserves typed acquisition failures and finalizes partially acquired application layers", async () => {
    let released = 0;
    const failure = new Error("acquisition failed");
    const EFFRONT = Application.effront<External>();
    const shell = EFFRONT.Layout.make({ render: ({ children }) => Effect.succeed(children) });
    const page = EFFRONT.Page.make({ render: () => Effect.succeed(null) });
    const app = EFFRONT.make({
      layer: Layer.effect(
        External,
        Effect.gen(function* () {
          yield* Effect.addFinalizer(() =>
            Effect.sync(() => {
              released++;
            }),
          );
          return yield* Effect.fail(failure);
        }),
      ),
      routes: EFFRONT.Routes.make({ layout: shell }).page("/probe", page),
    });
    const error = await Effect.runPromise(
      Effect.scoped(
        toHttpEffect(app).pipe(
          Effect.provideService(
            HttpServerRequest.HttpServerRequest,
            HttpServerRequest.fromWeb(request("failure")),
          ),
          Effect.flip,
        ),
      ),
    );
    expect(error).toBe(failure);
    expect(released).toBe(1);
  });
});
