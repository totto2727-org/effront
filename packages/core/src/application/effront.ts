import { MutableRef } from "effect";

import type { ComponentFactory } from "./component.ts";
import { makeComponentFactory } from "./component.ts";
import { makeApplication } from "./definition.tsx";
import type { EFFRONTMake } from "./definition.tsx";
import {
  attachEFFRONTMember,
  authoringTypeError,
  getEFFRONTIdentity,
  makeEFFRONTIdentity,
} from "./effront-identity.ts";
import type { EFFRONTIdentity, EFFRONTMember } from "./effront-identity.ts";
import type { LayoutFactory } from "./layout.ts";
import { makeLayoutFactory } from "./layout.ts";
import type { LoadingFactory } from "./loading.ts";
import { makeLoadingFactory } from "./loading.ts";
import { getMiddlewareState, makeMiddlewareFactory } from "./middleware.ts";
import type {
  AnyMiddleware,
  MiddlewareFactory,
  MiddlewareProvidedServices,
  MiddlewareRequiredServices,
} from "./middleware.ts";
import type { PageFactory } from "./page.ts";
import { makePageFactory } from "./page.ts";
import type { RoutesFactory } from "./routes.ts";
import { makeRoutesFactory } from "./routes.ts";
import type { ServerFnFactory } from "./server-fn.ts";
import { makeServerFnFactory } from "./server-fn.ts";

type ApplicableMiddleware<AvailableServices, Value> = [
  Exclude<MiddlewareRequiredServices<Value>, AvailableServices>,
] extends [never]
  ? unknown
  : never;

export type EFFRONT<ApplicationServices, AvailableServices = ApplicationServices> = EFFRONTMember<
  ApplicationServices,
  "EFFRONT"
> &
  Readonly<{
    Component: ComponentFactory<ApplicationServices, AvailableServices>;
    Layout: LayoutFactory<ApplicationServices, AvailableServices>;
    Loading: LoadingFactory<ApplicationServices>;
    Middleware: MiddlewareFactory<ApplicationServices, AvailableServices>;
    Page: PageFactory<ApplicationServices, AvailableServices>;
    Routes: RoutesFactory<ApplicationServices>;
    ServerFn: ServerFnFactory<ApplicationServices, AvailableServices>;
    make: EFFRONTMake<ApplicationServices>;
    withMiddleware: <Value extends AnyMiddleware<ApplicationServices>>(
      middleware: Value & ApplicableMiddleware<AvailableServices, Value>,
    ) => EFFRONT<ApplicationServices, AvailableServices | MiddlewareProvidedServices<Value>>;
  }>;

type AuthoringContext<Services> = Readonly<{
  allocateRouteScopeId: () => number;
  identity: EFFRONTIdentity<Services>;
  make: EFFRONTMake<Services>;
}>;

const makeEFFRONT = <ApplicationServices, AvailableServices>(
  context: AuthoringContext<ApplicationServices>,
  middleware: Readonly<AnyMiddleware<ApplicationServices>[]>,
): EFFRONT<ApplicationServices, AvailableServices> => {
  const { allocateRouteScopeId, identity, make } = context;
  const withMiddleware = <Value extends AnyMiddleware<ApplicationServices>>(
    value: Value & ApplicableMiddleware<AvailableServices, Value>,
  ): EFFRONT<ApplicationServices, AvailableServices | MiddlewareProvidedServices<Value>> => {
    getMiddlewareState(value);
    if (getEFFRONTIdentity(value) !== identity) {
      throw authoringTypeError("Middleware was created by a different EFFRONT module.");
    }
    if (middleware.includes(value)) {
      throw authoringTypeError("Middleware cannot appear twice in the same scope.");
    }

    return makeEFFRONT(context, Object.freeze([...middleware, value]));
  };

  return Object.freeze(
    attachEFFRONTMember(
      {
        Component: makeComponentFactory<ApplicationServices, AvailableServices>(
          identity,
          middleware,
        ),
        Layout: makeLayoutFactory<ApplicationServices, AvailableServices>(identity, middleware),
        Loading: makeLoadingFactory(identity),
        Middleware: makeMiddlewareFactory<ApplicationServices, AvailableServices>(identity),
        Page: makePageFactory<ApplicationServices, AvailableServices>(identity, middleware),
        Routes: makeRoutesFactory(identity, middleware, allocateRouteScopeId),
        ServerFn: makeServerFnFactory<ApplicationServices, AvailableServices>(identity, middleware),
        make,
        withMiddleware,
      },
      identity,
      "EFFRONT",
    ),
  );
};

const firstRouteScopeId = 0;

const effront = <Services = never>(): EFFRONT<Services> => {
  const identity = makeEFFRONTIdentity<Services>();
  const make: EFFRONTMake<Services> = (options) => makeApplication(identity, options);
  const nextRouteScopeId = MutableRef.make(firstRouteScopeId);
  const allocateRouteScopeId = (): number => MutableRef.getAndIncrement(nextRouteScopeId);

  return makeEFFRONT({ allocateRouteScopeId, identity, make }, Object.freeze([]));
};

export const Application = { effront } as const;
