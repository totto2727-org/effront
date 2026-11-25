import type { CoreSource } from "./core-source.tsx";

export const coreModelSources = {
  applicationIdentity: {
    code: `const effront = <Services = never>(): EFFRONT<Services> => {
  const identity = makeEFFRONTIdentity<Services>();
  const make: EFFRONTMake<Services> = (options) => makeApplication(identity, options);
  const nextRouteScopeId = MutableRef.make(firstRouteScopeId);
  const allocateRouteScopeId = (): number => MutableRef.getAndIncrement(nextRouteScopeId);

  return makeEFFRONT({ allocateRouteScopeId, identity, make }, Object.freeze([]));
};`,
    language: "ts",
    path: "packages/core/src/application/effront.ts",
  },
  compiledDestination: {
    code: `export type RouteScope<Services> = Readonly<{
  id: string;
  layout: LayoutComponent<Services> | null;
  loading: LoadingComponent<Services> | null;
}>;

export type CompiledDestination<Services> = Readonly<{
  middleware: Readonly<AnyMiddleware<Services>[]>;
  page: PageImplementationState<Services>;
  pattern: AbsolutePath;
  scopes: Readonly<RouteScope<Services>[]>;
}>;

export type CompiledRouteGraph<Services> = Readonly<
  [CompiledDestination<Services>, ...CompiledDestination<Services>[]]
>;`,
    language: "ts",
    path: "packages/core/src/application/route-graph.ts",
  },
  fetchBoundary: {
    code: `  const handler = HttpEffect.toWebHandler(toHttpEffect(application));
  return (request, env, executionContext) =>
    handler(request, Context.make(WorkersRequestContext, { env, executionContext, request }));`,
    language: "ts",
    path: "packages/core/src/workers.ts",
  },
  middlewareScope: {
    code: `  const withMiddleware = <Value extends AnyMiddleware<ApplicationServices>>(
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
  };`,
    language: "ts",
    path: "packages/core/src/application/effront.ts",
  },
  parameterValidation: {
    code: `      Effect.matchEffect({
        onFailure: () => Effect.succeed(pageNotFound()),
        onSuccess: (value) =>
          renderPageResponse(identity, options, {
            params: pageParams.Decoded({ value }),
            pathname,
          }),
      }),`,
    language: "ts",
    path: "packages/core/src/server/application-render.ts",
  },
  routeTraversal: {
    code: `    Array.forEach(state.pages, (route) => {
      const pattern = joinRoutePaths(prefix, route.path);
      validateUnreservedPath(pattern);
      const page = getPageState(route.page);
      destinations.push(Object.freeze({ middleware, page, pattern, scopes }));
    });
    Array.forEach(state.mounts, (mount) => {
      visit(mount.routes, joinRoutePaths(prefix, mount.path), { middleware, scopes });
    });
  };`,
    language: "ts",
    path: "packages/core/src/application/route-graph.ts",
  },
} satisfies Record<string, CoreSource>;
