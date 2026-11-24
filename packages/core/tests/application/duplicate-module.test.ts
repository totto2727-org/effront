import { expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { vi } from "vitest";

import { getApplicationState } from "#core/application/definition.tsx";
import { getEFFRONTIdentity } from "#core/application/effront-identity.ts";
import { getPageState } from "#core/application/page.ts";
import { getRoutesState } from "#core/application/routes.ts";
import { matchServerFnInvocation } from "#core/application/server-fn.ts";

it.effect("composes values loaded from a duplicated framework module instance", () =>
  Effect.gen(function* () {
    vi.resetModules();
    const { Application } = yield* Effect.promise(() => import("#core/application/effront.ts"));
    const EFFRONT = Application.effront();
    const RootLayout = EFFRONT.Layout.make({ render: ({ children }) => Effect.succeed(children) });
    const Page = EFFRONT.Page.make({ render: () => Effect.succeed(null) });
    const ServerFn = EFFRONT.ServerFn.make({
      input: Schema.String,
      handler: (input) => Effect.succeed(input),
    });
    const Routes = EFFRONT.Routes.make({ layout: RootLayout }).page("/", Page);
    const App = EFFRONT.make({ routes: Routes });

    expect(getPageState(Page).decodeParams).toBeNull();
    expect(getRoutesState(Routes).paths).toStrictEqual(["/"]);
    expect(getApplicationState(App).routes).toHaveLength(1);

    const invocation = ServerFn("hello");
    expect(matchServerFnInvocation(invocation, getEFFRONTIdentity(ServerFn))._tag).toBe("Match");
  }),
);
