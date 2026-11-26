import { Data, Effect, Schema } from "effect";
import type { Types } from "effect";
import { createElement } from "react";
import type { ReactNode } from "react";

import { PageViewTransitionBoundary } from "#core/client/page-view-transition.tsx";
import { PageViewTransition, resolvePageViewTransition } from "./page-view-transition.ts";
import type { PageViewTransitionConfig } from "./page-view-transition.ts";

import {
  authoringTypeError,
  EFFRONTIdentityTypeId,
  isEFFRONTMember,
  EFFRONTMemberKindTypeId,
  EFFRONTStateTypeId,
} from "./effront-identity.ts";
import type { EFFRONTIdentity, EFFRONTStatefulMember } from "./effront-identity.ts";
import type { AnyMiddleware } from "./middleware.ts";
import type { ValidRouteParamName } from "./route-path.ts";

declare const PageContractTypeId: unique symbol;

export type PageParamsSchema<Services> = Schema.ConstraintCodec<
  Readonly<Record<string, unknown>>,
  Readonly<Record<string, unknown>>,
  Services,
  unknown
>;

type PageParamKeys<ParamsSchema> =
  ParamsSchema extends Readonly<{ Encoded: infer Encoded }>
    ? Extract<keyof Encoded, string>
    : never;
type NonStringPageParamKeys<ParamsSchema> =
  ParamsSchema extends Readonly<{
    Encoded: infer Encoded;
  }>
    ? Exclude<keyof Encoded, string>
    : never;
type InvalidPageParamName<Name extends string> =
  Name extends ValidRouteParamName<Name> ? never : Name;
type InvalidPageParamValueKeys<ParamsSchema> =
  ParamsSchema extends Readonly<{
    Encoded: infer Encoded;
  }>
    ? {
        [Key in Extract<keyof Encoded, string>]-?: unknown extends Encoded[Key]
          ? never
          : [Extract<Encoded[Key], string>] extends [never]
            ? Key
            : never;
      }[Extract<keyof Encoded, string>]
    : never;
type InvalidPageParamsSchema<ParamsSchema> =
  | NonStringPageParamKeys<ParamsSchema>
  | InvalidPageParamName<PageParamKeys<ParamsSchema>>
  | InvalidPageParamValueKeys<ParamsSchema>;
type ValidPageParamsSchema<ParamsSchema> = [PageParamKeys<ParamsSchema>] extends [never]
  ? never
  : string extends PageParamKeys<ParamsSchema>
    ? never
    : [InvalidPageParamsSchema<ParamsSchema>] extends [never]
      ? unknown
      : never;

export type PageConcern<
  out ParamNames extends string,
  out Mode extends "Parameterized" | "Static",
> = Readonly<{
  [PageContractTypeId]: Readonly<{
    mode: Types.Covariant<Mode>;
    paramNames: Types.Covariant<ParamNames>;
  }>;
}>;

export type EncodedPageParams = Readonly<Record<string, string | undefined>>;
export type PageParams = Data.TaggedEnum<{
  Decoded: Readonly<{ value: Readonly<Record<string, unknown>> }>;
  Encoded: Readonly<{ value: EncodedPageParams }>;
}>;

export const pageParams = Data.taggedEnum<PageParams>();
const isDecodedParams = pageParams.$is("Decoded");

export type PageRuntimeProps = Readonly<{
  params: PageParams;
}>;
export type PageComponent = (props: PageRuntimeProps) => Promise<Awaited<ReactNode>>;
type DecodePageParams<Services> = (
  input: EncodedPageParams,
) => Effect.Effect<Readonly<Record<string, unknown>>, Schema.SchemaError, Services>;

export type StaticPageDefinition<Services> = EFFRONTStatefulMember<
  Services,
  "Page",
  PageImplementationState
> &
  PageConcern<never, "Static">;
export type ParameterizedPageDefinition<
  Services,
  ParamNames extends string = string,
> = EFFRONTStatefulMember<Services, "Page", PageImplementationState> &
  PageConcern<ParamNames, "Parameterized">;
export type AnyPageDefinition<Services> =
  | StaticPageDefinition<Services>
  | ParameterizedPageDefinition<Services>;

export type PageImplementationState<Services = unknown> = Readonly<{
  component: PageComponent;
  boundary: (props: Readonly<{ children: ReactNode }>) => Promise<ReactNode>;
  decodeParams: DecodePageParams<Services> | null;
}>;

class PageDefinitionImpl<
  Services,
  ParamNames extends string,
  Mode extends "Parameterized" | "Static",
  ParamsServices,
>
  implements
    EFFRONTStatefulMember<Services, "Page", PageImplementationState>,
    PageConcern<ParamNames, Mode>
{
  declare public [PageContractTypeId]: Readonly<{
    mode: Types.Covariant<Mode>;
    paramNames: Types.Covariant<ParamNames>;
  }>;
  public [EFFRONTIdentityTypeId]: EFFRONTIdentity<Services>;
  public [EFFRONTMemberKindTypeId] = "Page" as const;
  public get [EFFRONTStateTypeId](): PageImplementationState {
    return this;
  }
  public component: PageComponent;
  public boundary: (props: Readonly<{ children: ReactNode }>) => Promise<ReactNode>;
  public decodeParams: DecodePageParams<ParamsServices> | null;

  public constructor(
    identity: EFFRONTIdentity<Services>,
    middleware: Readonly<AnyMiddleware<Services>[]>,
    {
      component,
      decodeParams,
      viewTransition,
    }: Readonly<{
      component: PageComponent;
      decodeParams: DecodePageParams<ParamsServices> | null;
      viewTransition: false | PageViewTransitionConfig | undefined;
    }>,
  ) {
    this[EFFRONTIdentityTypeId] = identity;
    this.component = component;
    this.decodeParams = decodeParams;
    // oxlint-disable-next-line typescript/promise-function-async -- The render runtime reports a missing scope synchronously.
    this.boundary = ({ children }) =>
      identity.renderRuntime.run(
        "Page",
        Effect.map(PageViewTransition, (defaults) =>
          createElement(
            PageViewTransitionBoundary,
            {
              config: resolvePageViewTransition(defaults, viewTransition),
            },
            children,
          ),
        ),
        middleware,
      );
    Object.freeze(this);
  }
}

export function getPageState<Services>(
  page: AnyPageDefinition<Services>,
): PageImplementationState<Services>;
// The compiled destination installs the Page's complete middleware chain before decoding.
// As with scoped middleware, its provided services are erased from the application contract.
export function getPageState(page: AnyPageDefinition<unknown>): PageImplementationState {
  if (!isEFFRONTMember(page, "Page")) {
    throw authoringTypeError("Page must be created with EFFRONT.Page.make.");
  }
  return page[EFFRONTStateTypeId];
}

type StaticPageOptions<Error, Services> = Readonly<{
  params?: never;
  viewTransition?: false | PageViewTransitionConfig | undefined;
  render: () => Effect.Effect<Awaited<ReactNode>, Error, Services>;
}>;
type ParameterizedPageOptions<
  ParamsSchema extends PageParamsSchema<Services>,
  Error,
  Services,
> = Readonly<{
  params: ParamsSchema;
  viewTransition?: false | PageViewTransitionConfig | undefined;
  render: (
    props: Readonly<{
      params: ParamsSchema["Type"];
    }>,
  ) => Effect.Effect<Awaited<ReactNode>, Error, Services>;
}>;

export type PageFactory<ApplicationServices, AvailableServices> = Readonly<{
  make: {
    <ParamsSchema extends PageParamsSchema<AvailableServices>, Error>(
      options: ParameterizedPageOptions<ParamsSchema, Error, AvailableServices> &
        ValidPageParamsSchema<ParamsSchema>,
    ): ParameterizedPageDefinition<ApplicationServices, PageParamKeys<ParamsSchema>>;
    <Error>(
      options: StaticPageOptions<Error, AvailableServices>,
    ): StaticPageDefinition<ApplicationServices>;
  };
}>;

const makeParameterizedPage = <ApplicationServices, AvailableServices, Error>(
  identity: EFFRONTIdentity<ApplicationServices>,
  middleware: Readonly<AnyMiddleware<ApplicationServices>[]>,
  {
    params: paramsSchema,
    render,
    viewTransition,
  }: ParameterizedPageOptions<PageParamsSchema<AvailableServices>, Error, AvailableServices>,
): ParameterizedPageDefinition<ApplicationServices> => {
  // oxlint-disable-next-line rules/require-top-level-decoder -- Compile the author-supplied schema once per Page definition.
  const decodeParams = Schema.decodeEffect(paramsSchema);
  // oxlint-disable-next-line typescript/promise-function-async -- Starting a page outside its render scope must throw synchronously.
  const component: PageComponent = ({ params }) =>
    identity.renderRuntime.run(
      "Page",
      (isDecodedParams(params) ? Effect.succeed(params.value) : decodeParams(params.value)).pipe(
        Effect.flatMap((decodedParams) => Effect.suspend(() => render({ params: decodedParams }))),
      ),
      middleware,
    );
  return new PageDefinitionImpl(identity, middleware, { component, decodeParams, viewTransition });
};

// oxlint-disable-next-line unicorn/no-null -- The page definition uses null when it has no parameter decoder.
const noDecoder = null;

export const makePageFactory = <ApplicationServices, AvailableServices>(
  identity: EFFRONTIdentity<ApplicationServices>,
  middleware: Readonly<AnyMiddleware<ApplicationServices>[]>,
): PageFactory<ApplicationServices, AvailableServices> => {
  function make<ParamsSchema extends PageParamsSchema<AvailableServices>, Error>(
    options: ParameterizedPageOptions<ParamsSchema, Error, AvailableServices> &
      ValidPageParamsSchema<ParamsSchema>,
  ): ParameterizedPageDefinition<ApplicationServices, PageParamKeys<ParamsSchema>>;
  function make<Error>(
    options: StaticPageOptions<Error, AvailableServices>,
  ): StaticPageDefinition<ApplicationServices>;
  function make<Error>(
    options:
      | Omit<StaticPageOptions<Error, AvailableServices>, "params">
      | ParameterizedPageOptions<PageParamsSchema<AvailableServices>, Error, AvailableServices>,
  ): AnyPageDefinition<ApplicationServices> {
    if ("params" in options) {
      return makeParameterizedPage(identity, middleware, options);
    }

    const { render } = options;
    // oxlint-disable-next-line typescript/promise-function-async -- Starting a page outside its render scope must throw synchronously.
    const component: PageComponent = () =>
      identity.renderRuntime.run("Page", Effect.suspend(render), middleware);
    return new PageDefinitionImpl<ApplicationServices, never, "Static", never>(
      identity,
      middleware,
      { component, decodeParams: noDecoder, viewTransition: options.viewTransition },
    );
  }

  return { make };
};
