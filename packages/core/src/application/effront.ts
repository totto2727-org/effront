import type { ComponentFactory } from "./component.ts";
import { makeComponentFactory } from "./component.ts";
import { makeApplication } from "./definition.tsx";
import type { EFFRONTMake } from "./definition.tsx";
import {
  attachEFFRONTMember,
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

const makeEFFRONT = <ApplicationServices, AvailableServices>(
  identity: EFFRONTIdentity<ApplicationServices>,
  middleware: Readonly<AnyMiddleware<ApplicationServices>[]>,
  allocateRouteScopeId: () => number,
  make: EFFRONTMake<ApplicationServices>,
): EFFRONT<ApplicationServices, AvailableServices> => {
  const withMiddleware = <Value extends AnyMiddleware<ApplicationServices>>(
    value: Value & ApplicableMiddleware<AvailableServices, Value>,
  ): EFFRONT<ApplicationServices, AvailableServices | MiddlewareProvidedServices<Value>> => {
    getMiddlewareState(value);
    if (getEFFRONTIdentity(value) !== identity) {
      throw new TypeError("Middleware was created by a different EFFRONT module.");
    }
    if (middleware.includes(value)) {
      throw new TypeError("Middleware cannot appear twice in the same scope.");
    }

    return makeEFFRONT(identity, Object.freeze([...middleware, value]), allocateRouteScopeId, make);
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

const effront = <Services = never>(): EFFRONT<Services> => {
  const identity = makeEFFRONTIdentity<Services>();
  const make: EFFRONTMake<Services> = (options) => makeApplication(identity, options);
  let nextRouteScopeId = 0;
  const allocateRouteScopeId = () => {
    const scopeId = nextRouteScopeId;
    nextRouteScopeId += 1;
    return scopeId;
  };

  return makeEFFRONT(identity, Object.freeze([]), allocateRouteScopeId, make);
};

export const Application = { effront } as const;
