import { expect, it } from "@effect/vitest";
import { Effect, Predicate, Schema } from "effect";
import { vi } from "vitest";

import { getApplicationState } from "#core/application/definition.tsx";
import { getEFFRONTIdentity } from "#core/application/effront-identity.ts";
import { getPageState } from "#core/application/page.ts";
import { getRoutesState } from "#core/application/routes.ts";
import { matchServerFnInvocation } from "#core/application/server-fn.ts";

// oxlint-disable-next-line unicorn/no-null -- React renders a null result as an empty Page.
const emptyPage = null;

const loadDuplicate = Effect.fnUntraced(function* () {
  vi.resetModules();
  const { Application } = yield* Effect.promise(async () => import("#core/application/effront.ts"));
  const EFFRONT = Application.effront();
  const RootLayout = EFFRONT.Layout.make({ render: ({ children }) => Effect.succeed(children) });
  const Page = EFFRONT.Page.make({ render: () => Effect.succeed(emptyPage) });
  const ServerFn = EFFRONT.ServerFn.make({
    handler: (input) => Effect.succeed(input),
    input: Schema.String,
  });
  const Routes = EFFRONT.Routes.make({ layout: RootLayout }).page("/", Page);
  const App = EFFRONT.make({ routes: Routes });
  return { App, Page, Routes, ServerFn };
});

it.effect("composes values loaded from a duplicated framework module instance", () =>
  Effect.gen(function* () {
    const { App, Page, Routes, ServerFn } = yield* loadDuplicate();
    expect(getPageState(Page).decodeParams).toBeNull();
    expect(getRoutesState(Routes).paths).toStrictEqual(["/"]);
    expect(getApplicationState(App).routes).toHaveLength(1);

    const invocation = ServerFn("hello");
    const matched = matchServerFnInvocation(invocation, getEFFRONTIdentity(ServerFn));
    expect(Predicate.isTagged(matched, "Match")).toBe(true);
  }),
);
