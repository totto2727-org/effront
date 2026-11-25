import { Array, Data, Effect, Predicate, Schema, Stream } from "effect";
import type { Types } from "effect";

import { attachEFFRONTMember, authoringTypeError } from "./effront-identity.ts";
import type { EFFRONTIdentity, EFFRONTMember } from "./effront-identity.ts";
import type { AnyMiddleware } from "./middleware.ts";
import { ServerFnInputError } from "#core/rsc/server-fn-error.ts";

const ServerFnInvocationTypeId: unique symbol = Symbol.for("effront/ServerFnInvocation");

// oxlint-disable-next-line unicorn/throw-new-error -- Effect's schema error builder supplies the error superclass.
export class ServerFnOperationError extends Schema.TaggedError<ServerFnOperationError>()(
  "ServerFnOperationError",
  { cause: Schema.Defect() },
) {}

type ServerFnInvocation<ApplicationServices> = Readonly<{
  [ServerFnInvocationTypeId]: Readonly<{
    effect: Effect.Effect<
      unknown,
      ServerFnInputError | ServerFnOperationError,
      ApplicationServices
    >;
    identity: EFFRONTIdentity<ApplicationServices>;
    middleware: Readonly<AnyMiddleware<ApplicationServices>[]>;
  }>;
}>;

// oxlint-disable-next-line typescript/no-generated-empty-object-type -- Effect represents a tag with no payload as an empty record.
type NoPayload = Record<never, never>;

type ServerFnInvocationMatch<ApplicationServices> = Data.TaggedEnum<{
  IdentityMismatch: NoPayload;
  Match: Omit<ServerFnInvocation<ApplicationServices>[typeof ServerFnInvocationTypeId], "identity">;
  Native: NoPayload;
}>;

// oxlint-disable-next-line eslint/no-magic-numbers -- Effect's generic enum binds its single ApplicationServices parameter.
interface InvocationMatchDefinition extends Data.TaggedEnum.WithGenerics<1> {
  taggedEnum: ServerFnInvocationMatch<this["A"]>;
}

const invocationMatches = Data.taggedEnum<InvocationMatchDefinition>();

type ServerFnInput<Services> =
  | Schema.ConstraintDecoder<unknown, Services>
  | Readonly<Schema.ConstraintDecoder<unknown, Services>[]>;

type ServerFnArguments<Input, Side extends "Type" | "Encoded"> =
  Input extends Readonly<Schema.Constraint[]>
    ? Types.Mutable<{
        [Key in keyof Input]: Input[Key] extends Schema.Constraint ? Input[Key][Side] : never;
      }>
    : Input extends Schema.Constraint
      ? [Input[Side]]
      : never;

interface ServerFunction<
  Args extends Readonly<unknown[]>,
  Output,
  ApplicationServices,
> extends EFFRONTMember<ApplicationServices, "ServerFn"> {
  (...args: Args): Promise<ServerFnWireValue<Output>>;
}

type ServerFnWireValue<Output> = [Output] extends [never]
  ? Output
  : [Output] extends [Stream.Stream<infer Value, infer _Error, infer _Services>]
    ? ReadableStream<Value>
    : Output;

type ValidateServerFnOutput<Output, Services> = [Output] extends [never]
  ? unknown
  : [Output] extends [Stream.Stream<infer _Value, infer Error, infer Requirements>]
    ? [Error] extends [never]
      ? [Requirements] extends [Services]
        ? unknown
        : Readonly<{ "A streaming Server Function must fit the application services": never }>
      : Readonly<{ "A streaming Server Function must handle its Stream errors": never }>
    : [Extract<Output, Stream.Stream<unknown, unknown, unknown>>] extends [never]
      ? unknown
      : Readonly<{ "A Server Function cannot mix Stream and non-stream results": never }>;

type ServerFnOptions<Input, Output, Error, Services> = Readonly<{
  handler: (...args: ServerFnArguments<Input, "Type">) => Effect.Effect<Output, Error, Services>;
}> &
  ([Input] extends [Readonly<[]>] ? Readonly<{ input?: Input }> : Readonly<{ input: Input }>);

export type ServerFnFactory<ApplicationServices, AvailableServices> = Readonly<{
  make: <
    const Input extends ServerFnInput<AvailableServices> = Readonly<[]>,
    Output = never,
    Error = never,
  >(
    options: ServerFnOptions<Input, Output, Error, AvailableServices> &
      ValidateServerFnOutput<Output, AvailableServices>,
  ) => ServerFunction<ServerFnArguments<Input, "Encoded">, Output, ApplicationServices>;
}>;

export const isServerFnStream = <Services>(
  value: unknown,
  // oxlint-disable-next-line rules/no-type-predicate -- The ServerFn factory contract guarantees stream errors and services. The Stream runtime brand identifies the variant.
): value is Stream.Stream<unknown, never, Services> => Stream.isStream(value);

const directInvocationError = (): TypeError =>
  authoringTypeError(
    "An EFFRONT ServerFn is a framework intrinsic and cannot be invoked directly in the server graph.",
  );

const isServerFnInvocation = <ApplicationServices>(
  value: unknown,
  // oxlint-disable-next-line rules/no-type-predicate -- The opaque cross-module symbol brands native promises with framework-owned metadata.
): value is ServerFnInvocation<ApplicationServices> =>
  Predicate.hasProperty(value, ServerFnInvocationTypeId);

export const matchServerFnInvocation = <ApplicationServices>(
  value: unknown,
  identity: EFFRONTIdentity<ApplicationServices>,
): ServerFnInvocationMatch<ApplicationServices> => {
  if (!isServerFnInvocation<ApplicationServices>(value)) {
    return invocationMatches.Native();
  }

  // The brand establishes the state shape.
  // The opaque application identity establishes the service universe erased by React.
  const metadata = value[ServerFnInvocationTypeId];
  if (metadata.identity !== identity) {
    return invocationMatches.IdentityMismatch();
  }

  return invocationMatches.Match({ effect: metadata.effect, middleware: metadata.middleware });
};

export const makeServerFnFactory = <ApplicationServices, AvailableServices>(
  identity: EFFRONTIdentity<ApplicationServices>,
  middleware: Readonly<AnyMiddleware<ApplicationServices>[]>,
): ServerFnFactory<ApplicationServices, AvailableServices> => ({
  make: ({ input = [], handler }) => {
    const schemas = Array.ensure<Schema.ConstraintDecoder<unknown, AvailableServices>>(input);
    // oxlint-disable-next-line rules/require-top-level-decoder, rules/prefer-non-unknown-decode -- Compile the author-supplied schemas once to validate unknown arguments arriving from React.
    const decode = Schema.decodeUnknownEffect(Schema.Tuple(schemas));
    type Result = ServerFnWireValue<Effect.Success<ReturnType<typeof handler>>>;
    // oxlint-disable-next-line typescript/promise-function-async -- React reads framework invocation metadata from this exact promise before awaiting it.
    const serverFunction = (
      ...untrustedArgs: ServerFnArguments<typeof input, "Encoded">
    ): Promise<Result> => {
      // Unary functions still ignore extra native arguments and decode undefined when omitted.
      const effect = decode(Array.isArray(input) ? untrustedArgs : [untrustedArgs[0]]).pipe(
        Effect.mapError(
          (cause) =>
            new ServerFnInputError({ detail: { message: cause.message, name: cause.name } }),
        ),
        Effect.flatMap((args: Readonly<unknown[]>) => {
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Successful tuple decoding against the authored schemas establishes the handler's argument types.
          const decodedArgs = args as Parameters<typeof handler>;
          return handler(...decodedArgs).pipe(
            Effect.mapError((cause) => new ServerFnOperationError({ cause })),
          );
        }),
      );
      const unavailable = Promise.reject<Result>(directInvocationError());
      // oxlint-disable-next-line promise/prefer-await-to-then -- React inspects the original rejected promise; handle it without wrapping or awaiting it.
      unavailable.catch(() => {
        // Direct calls still reject through the original promise.
      });

      return Object.assign(unavailable, {
        [ServerFnInvocationTypeId]: Object.freeze({ effect, identity, middleware }),
      });
    };

    return attachEFFRONTMember(serverFunction, identity, "ServerFn");
  },
});
