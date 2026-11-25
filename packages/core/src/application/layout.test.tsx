import { describe, expect, it, test } from "@effect/vitest";
import { Context, Effect, FiberSet, Layer } from "effect";
import type { ReactNode } from "react";

import { Application } from "./effront.ts";
import { getEFFRONTIdentity } from "./effront-identity.ts";
import { emptyNode, makeInterruptionProbe } from "./render-interruption.fixture.ts";

class ShellTitle extends Context.Service<ShellTitle, Readonly<{ value: string }>>()(
  "effront/tests/application/layout/ShellTitle",
) {}

const EFFRONT = Application.effront<ShellTitle>();

describe("eFFRONT.Layout.make", () => {
  test("rejects rendering outside its application request runtime", () => {
    const ServiceFreeEFFRONT = Application.effront();
    const Layout = ServiceFreeEFFRONT.Layout.make({
      render: ({ children }) => Effect.succeed(children),
    });

    expect((): unknown => Layout({ children: emptyNode })).toThrow(
      expect.objectContaining({
        message: "EFFRONT Layout rendered outside its application request runtime.",
        name: "TypeError",
      }),
    );
  });
});

it.effect("infers children as an immediately renderable node", () =>
  Effect.gen(function* () {
    const runtime = yield* FiberSet.makeRuntimePromise();
    const ServiceFreeEFFRONT = Application.effront();
    const PassthroughLayout = ServiceFreeEFFRONT.Layout.make({
      render: ({ children }) => Effect.succeed(children),
    });
    const Page = ServiceFreeEFFRONT.Page.make({ render: () => Effect.succeed(emptyNode) });
    const App = ServiceFreeEFFRONT.make({
      routes: ServiceFreeEFFRONT.Routes.make({ layout: PassthroughLayout }).page("/", Page),
    });
    const child = <main>Home</main>;

    const rendered = yield* Effect.promise(async () =>
      getEFFRONTIdentity(App).renderRuntime.bind(runtime, [], async () =>
        PassthroughLayout({ children: child }),
      ),
    );

    expect(rendered).toBe(child);
  }),
);

it.effect("runs an Effect operation with children and request services", () =>
  Effect.gen(function* () {
    const runtime = yield* FiberSet.makeRuntimePromise<ShellTitle>();
    const LayoutComponent = EFFRONT.Layout.make({
      render: Effect.fn(function* ({ children }) {
        const inferredChildren: ReactNode = children;
        const title = yield* ShellTitle;
        return (
          <html lang="en">
            <head>
              <title>{title.value}</title>
            </head>
            <body>{inferredChildren}</body>
          </html>
        );
      }),
    });
    const Page = EFFRONT.Page.make({ render: () => Effect.succeed(emptyNode) });
    const App = EFFRONT.make({
      layer: Layer.succeed(ShellTitle, { value: "application title" }),
      routes: EFFRONT.Routes.make({ layout: LayoutComponent }).page("/", Page),
    });

    const rendered = yield* Effect.promise(async () =>
      getEFFRONTIdentity(App).renderRuntime.bind(runtime, [], async () =>
        LayoutComponent({ children: <main>Home</main> }),
      ),
    );

    expect(rendered).toStrictEqual(
      <html lang="en">
        <head>
          <title>Request title</title>
        </head>
        <body>
          <main>Home</main>
        </body>
      </html>,
    );
  }).pipe(Effect.provideService(ShellTitle, { value: "Request title" })),
);

it.effect("interrupts the layout operation when its request scope closes", () =>
  Effect.gen(function* () {
    const { closeDuring, render, runtime } = yield* makeInterruptionProbe();
    const AppBuilder = Application.effront();
    const Layout = AppBuilder.Layout.make({ render });
    const Page = AppBuilder.Page.make({ render: () => Effect.succeed(emptyNode) });
    const App = AppBuilder.make({
      routes: AppBuilder.Routes.make({ layout: Layout }).page("/", Page),
    });
    const { renderRuntime } = getEFFRONTIdentity(App);
    const execution = renderRuntime.bind(runtime, [], async () => Layout({ children: emptyNode }));
    const observed = yield* closeDuring(execution);
    expect(observed).toStrictEqual({ result: "interrupted", wasInterrupted: true });
  }),
);
