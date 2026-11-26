import { describe, expect, it, test } from "@effect/vitest";
import { Context, Effect, FiberSet, Layer, Schema, SchemaTransformation } from "effect";

import { Application } from "./effront.ts";
import { getEFFRONTIdentity } from "./effront-identity.ts";
import { emptyNode, makeInterruptionProbe } from "./render-interruption.fixture.ts";
import { getPageState, pageParams } from "./page.ts";

class Greeting extends Context.Service<Greeting, Readonly<{ value: string }>>()(
  "effront/tests/application/page/Greeting",
) {}

const EFFRONT = Application.effront<Greeting>();
const RootLayout = EFFRONT.Layout.make({ render: ({ children }) => Effect.succeed(children) });
const transformedPathParams = Schema.Struct({ slug: Schema.String }).pipe(
  Schema.decodeTo(
    Schema.Struct({ id: Schema.String }),
    SchemaTransformation.transform({
      decode: ({ slug }) => ({ id: slug }),
      encode: ({ id }) => ({ slug: id }),
    }),
  ),
);

describe("eFFRONT.Page.make", () => {
  test("rejects rendering outside its application request runtime", () => {
    const ServiceFreeEFFRONT = Application.effront();
    const Page = ServiceFreeEFFRONT.Page.make({ render: () => Effect.succeed(emptyNode) });

    const render = (): unknown =>
      getPageState(Page).component({ params: pageParams.Encoded({ value: {} }) });
    expect(render).toThrow(
      expect.objectContaining({
        message: "EFFRONT Page rendered outside its application request runtime.",
        name: "TypeError",
      }),
    );
  });
});

it.effect("decodes dynamic route params before invoking the render operation", () =>
  Effect.gen(function* () {
    const runtime = yield* FiberSet.makeRuntimePromise<Greeting>();
    const PageComponent = EFFRONT.Page.make({
      params: Schema.Struct({
        day: Schema.Literals(["saturday", "sunday"]),
      }),
      render: Effect.fnUntraced(function* ({ params }) {
        const greeting = yield* Greeting;
        return `${greeting.value} ${params.day}`;
      }),
    });
    const rendered = yield* Effect.promise(async () =>
      getEFFRONTIdentity(PageComponent).renderRuntime.bind(runtime, [], async () =>
        getPageState(PageComponent).component({
          params: pageParams.Encoded({ value: { day: "sunday" } }),
        }),
      ),
    );

    expect(rendered).toBe("hello sunday");
    expect(getPageState(PageComponent).decodeParams).not.toBeNull();
    expect(Object.isFrozen(PageComponent)).toBe(true);
  }).pipe(Effect.provideService(Greeting, { value: "hello" })),
);

it.effect("runs an Effect.fn operation with request services", () =>
  Effect.gen(function* () {
    const runtime = yield* FiberSet.makeRuntimePromise<Greeting>();
    const PageComponent = EFFRONT.Page.make({
      render: Effect.fnUntraced(function* () {
        const greeting = yield* Greeting;
        return greeting.value;
      }),
    });
    const App = EFFRONT.make({
      layer: Layer.succeed(Greeting, { value: "application greeting" }),
      routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/", PageComponent),
    });

    const rendered = yield* Effect.promise(async () =>
      getEFFRONTIdentity(App).renderRuntime.bind(runtime, [], async () =>
        getPageState(PageComponent).component({ params: pageParams.Encoded({ value: {} }) }),
      ),
    );

    expect(rendered).toBe("hello from the request");
    expect(getPageState(PageComponent).decodeParams).toBeNull();
  }).pipe(Effect.provideService(Greeting, { value: "hello from the request" })),
);

it.effect("decodes encoded path keys into the Schema output consumed by render", () =>
  Effect.gen(function* () {
    const runtime = yield* FiberSet.makeRuntimePromise();
    const TransformEFFRONT = Application.effront();
    const PageComponent = TransformEFFRONT.Page.make({
      params: transformedPathParams,
      render: ({ params }) => Effect.succeed(params.id),
    });
    const rendered = yield* Effect.promise(async () =>
      getEFFRONTIdentity(PageComponent).renderRuntime.bind(runtime, [], async () =>
        getPageState(PageComponent).component({
          params: pageParams.Encoded({ value: { slug: "opening-keynote" } }),
        }),
      ),
    );

    expect(rendered).toBe("opening-keynote");
  }),
);

it.effect("interrupts the page operation when its request scope closes", () =>
  Effect.gen(function* () {
    const { closeDuring, render, runtime } = yield* makeInterruptionProbe();
    const AppBuilder = Application.effront();
    const Layout = AppBuilder.Layout.make({ render: ({ children }) => Effect.succeed(children) });
    const Page = AppBuilder.Page.make({ render });
    const App = AppBuilder.make({
      routes: AppBuilder.Routes.make({ layout: Layout }).page("/", Page),
    });
    const { renderRuntime } = getEFFRONTIdentity(App);
    const execution = renderRuntime.bind(runtime, [], async () =>
      getPageState(Page).component({ params: pageParams.Encoded({ value: {} }) }),
    );
    const observed = yield* closeDuring(execution);
    expect(observed).toStrictEqual({ result: "interrupted", wasInterrupted: true });
  }),
);
