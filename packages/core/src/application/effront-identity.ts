import { Predicate } from "effect";
import type { Types } from "effect";

import { makeRenderRuntimeContext } from "./render-runtime.ts";
import type { RenderRuntimeContext } from "./render-runtime.ts";

declare const EFFRONTServicesTypeId: unique symbol;

export const EFFRONTIdentityTypeId: unique symbol = Symbol.for("effront/EFFRONTIdentity");
export const EFFRONTMemberKindTypeId: unique symbol = Symbol.for("effront/EFFRONTMemberKind");
export const EFFRONTStateTypeId: unique symbol = Symbol.for("effront/EFFRONTState");

export type EFFRONTMemberKind =
  | "Application"
  | "Component"
  | "EFFRONT"
  | "Layout"
  | "Loading"
  | "Middleware"
  | "Page"
  | "Routes"
  | "ServerFn";

export type EFFRONTIdentity<Services> = Readonly<{
  [EFFRONTServicesTypeId]?: Types.Invariant<Services>;
  renderRuntime: RenderRuntimeContext;
}>;

type EFFRONTMemberKindMarker<Kind extends EFFRONTMemberKind> = Readonly<{
  [EFFRONTMemberKindTypeId]: Kind;
}>;

export type EFFRONTMember<
  Services,
  Kind extends EFFRONTMemberKind = EFFRONTMemberKind,
> = EFFRONTMemberKindMarker<Kind> &
  Readonly<{ [EFFRONTIdentityTypeId]: EFFRONTIdentity<Services> }>;

export type EFFRONTStatefulMember<Services, Kind extends EFFRONTMemberKind, State> = EFFRONTMember<
  Services,
  Kind
> &
  Readonly<{ [EFFRONTStateTypeId]: State }>;

export const makeEFFRONTIdentity = <Services>(): EFFRONTIdentity<Services> => ({
  renderRuntime: makeRenderRuntimeContext(),
});

export const attachEFFRONTMember = <
  Member extends object,
  Services,
  const Kind extends EFFRONTMemberKind,
>(
  member: Member,
  identity: EFFRONTIdentity<Services>,
  kind: Kind,
): Member & EFFRONTMember<Services, Kind> =>
  Object.assign(member, { [EFFRONTIdentityTypeId]: identity, [EFFRONTMemberKindTypeId]: kind });

export const isEFFRONTMember = <const Kind extends EFFRONTMemberKind>(
  value: unknown,
  kind: Kind,
  // oxlint-disable-next-line rules/no-type-predicate -- The opaque runtime symbol also brands callable members with their exact kind.
): value is EFFRONTMemberKindMarker<Kind> =>
  Predicate.hasProperty(value, EFFRONTMemberKindTypeId) && value[EFFRONTMemberKindTypeId] === kind;

export const authoringTypeError = (message: string): TypeError =>
  // oxlint-disable-next-line rules/require-tagged-error -- Invalid synchronous calls to Effront authoring factories throw TypeError.
  new TypeError(message);

export const getEFFRONTIdentity = <Services>(
  member: EFFRONTMember<Services>,
): EFFRONTIdentity<Services> => member[EFFRONTIdentityTypeId];
