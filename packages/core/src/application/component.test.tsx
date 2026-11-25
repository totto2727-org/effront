import { describe, expect, it, test } from "@effect/vitest";
import { Context, Effect, FiberSet, MutableRef } from "effect";

import { Application } from "./effront.ts";
import { getEFFRONTIdentity } from "./effront-identity.ts";
import { emptyNode, makeInterruptionProbe } from "./render-interruption.fixture.ts";
import type { RenderRuntime } from "./render-runtime.ts";

class Greeting extends Context.Service<Greeting, Readonly<{ prefix: string }>>()(
  "effront/tests/application/component/Greeting",
) {}

describe("eFFRONT.Component.make", () => {
  test("rejects rendering outside its application request runtime", () => {
    const EFFRONT = Application.effront();
    const Component = EFFRONT.Component.make({ render: () => Effect.succeed(emptyNode) });

    expect((): unknown => Component({})).toThrow(
      expect.objectContaining({
        message: "EFFRONT Component rendered outside its application request runtime.",
        name: "TypeError",
      }),
    );
  });
});

it.effect("runs props and services through the request runtime", () =>
  Effect.gen(function* () {
    const EFFRONT = Application.effront<Greeting>();
    const runtime = yield* FiberSet.makeRuntimePromise<Greeting>();
    const GreetingComponent = EFFRONT.Component.make({
      render: Effect.fn(function* ({ name }: Readonly<{ name: string }>) {
        const greeting = yield* Greeting;
        return <p>{`${greeting.prefix}, ${name}`}</p>;
      }),
    });

    const rendered = yield* Effect.promise(async () =>
      getEFFRONTIdentity(EFFRONT).renderRuntime.bind(runtime, [], async () =>
        GreetingComponent({ name: "Nikhil" }),
      ),
    );

    expect(rendered).toStrictEqual(<p>Hello, Nikhil</p>);
  }).pipe(Effect.provideService(Greeting, { prefix: "Hello" })),
);

it.effect("rejects rendering outside its authored middleware scope", () =>
  Effect.gen(function* () {
    const EFFRONT = Application.effront();
    const RequireScope = EFFRONT.Middleware.make((httpEffect) => httpEffect);
    const ScopedEFFRONT = EFFRONT.withMiddleware(RequireScope);
    const Component = ScopedEFFRONT.Component.make({ render: () => Effect.succeed("scoped") });
    const runtime = yield* FiberSet.makeRuntimePromise();
    const { renderRuntime } = getEFFRONTIdentity(EFFRONT);

    const outsideScope = (): unknown =>
      renderRuntime.bind(runtime, [], (): unknown => Component({}));
    expect(outsideScope).toThrow(
      expect.objectContaining({
        message:
          "EFFRONT Component requires a middleware scope that is not active for this request.",
        name: "TypeError",
      }),
    );
    const rendered = yield* Effect.promise(async () =>
      renderRuntime.bind(runtime, [RequireScope], async () => Component({})),
    );
    expect(rendered).toBe("scoped");
  }),
);

it.effect("invokes the authored renderer from inside Effect execution", () =>
  Effect.gen(function* () {
    const EFFRONT = Application.effront();
    const runtimeEntered = MutableRef.make(false);
    const run = yield* FiberSet.makeRuntimePromise();
    const runtime: RenderRuntime<never> = async (effect) => {
      MutableRef.set(runtimeEntered, true);
      try {
        return await run(effect);
      } finally {
        MutableRef.set(runtimeEntered, false);
      }
    };
    const Component = EFFRONT.Component.make({
      render: () => {
        expect(MutableRef.get(runtimeEntered)).toBe(true);
        return Effect.succeed(<p>Rendered</p>);
      },
    });

    const rendered = yield* Effect.promise(async () =>
      getEFFRONTIdentity(EFFRONT).renderRuntime.bind(runtime, [], async () => Component({})),
    );

    expect(rendered).toStrictEqual(<p>Rendered</p>);
    expect(MutableRef.get(runtimeEntered)).toBe(false);
  }),
);

it.effect("interrupts component work when its request scope closes", () =>
  Effect.gen(function* () {
    const { closeDuring, render, runtime } = yield* makeInterruptionProbe();
    const EFFRONT = Application.effront();
    const Component = EFFRONT.Component.make({ render });
    const { renderRuntime } = getEFFRONTIdentity(EFFRONT);
    const execution = renderRuntime.bind(runtime, [], async () => Component({}));
    const observed = yield* closeDuring(execution);
    expect(observed).toStrictEqual({ result: "interrupted", wasInterrupted: true });
  }),
);
