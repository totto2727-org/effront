import { Array, Effect, Predicate, Schema, Stream } from "effect";

import { attachEFFRONTMember } from "./effront-identity.ts";
import type { EFFRONTIdentity, EFFRONTMember } from "./effront-identity.ts";
import type { AnyMiddleware } from "./middleware.ts";
import { ServerFnInputError } from "#core/rsc/server-fn-error.ts";

const ServerFnInvocationTypeId: unique symbol = Symbol.for("effront/ServerFnInvocation");

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

type ServerFnInvocationMatch<ApplicationServices> =
  | Readonly<{ _tag: "Native" }>
  | Readonly<{ _tag: "IdentityMismatch" }>
  | Readonly<{
      _tag: "Match";
      effect: Effect.Effect<
        unknown,
        ServerFnInputError | ServerFnOperationError,
        ApplicationServices
      >;
      middleware: Readonly<AnyMiddleware<ApplicationServices>[]>;
    }>;

type ServerFnInput<Services> =
  | Schema.ConstraintDecoder<unknown, Services>
  | Readonly<Schema.ConstraintDecoder<unknown, Services>[]>;

type ServerFnArguments<Input, Side extends "Type" | "Encoded"> =
  Input extends Readonly<Schema.Constraint[]>
    ? {
        -readonly [Key in keyof Input]: Input[Key] extends Schema.Constraint
          ? Input[Key][Side]
          : never;
      }
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
): value is Stream.Stream<unknown, never, Services> => Stream.isStream(value);

const directInvocationError = () =>
  new TypeError(
    "An EFFRONT ServerFn is a framework intrinsic and cannot be invoked directly in the server graph.",
  );

const isServerFnInvocation = <ApplicationServices>(
  value: unknown,
): value is ServerFnInvocation<ApplicationServices> =>
  Predicate.hasProperty(value, ServerFnInvocationTypeId);

export const matchServerFnInvocation = <ApplicationServices>(
  value: unknown,
  identity: EFFRONTIdentity<ApplicationServices>,
): ServerFnInvocationMatch<ApplicationServices> => {
  if (!isServerFnInvocation<ApplicationServices>(value)) {
    return { _tag: "Native" };
  }

  // The framework-owned brand proves the state shape; matching the opaque identity proves the
  // application service universe erased by the native React invocation.
  const metadata = value[ServerFnInvocationTypeId];
  if (metadata.identity !== identity) {
    return { _tag: "IdentityMismatch" };
  }

  return { _tag: "Match", effect: metadata.effect, middleware: metadata.middleware };
};

export const makeServerFnFactory = <ApplicationServices, AvailableServices>(
  identity: EFFRONTIdentity<ApplicationServices>,
  middleware: Readonly<AnyMiddleware<ApplicationServices>[]>,
): ServerFnFactory<ApplicationServices, AvailableServices> => ({
  make: ({ input = [], handler }) => {
    const schemas = Array.ensure<Schema.ConstraintDecoder<unknown, AvailableServices>>(input);
    // oxlint-disable-next-line rules/require-top-level-decoder -- Compile the author-supplied schema once per Server Function.
    const decode = Schema.decodeUnknownEffect(Schema.Tuple(schemas));
    const serverFunction = (...untrustedArgs: ServerFnArguments<typeof input, "Encoded">) => {
      // Unary functions still ignore extra native arguments and decode undefined when omitted.
      const effect = decode(Array.isArray(input) ? untrustedArgs : [untrustedArgs[0]]).pipe(
        Effect.mapError(
          (cause) =>
            new ServerFnInputError({ detail: { message: cause.message, name: cause.name } }),
        ),
        Effect.flatMap((args: Readonly<unknown[]>) =>
          // Array.ensure widens the input schemas to an array, so Tuple decoding loses the
          // positional Type tuple. Successful decoding against those same schemas establishes
          // the handler's argument types, but TypeScript cannot recover that relationship here.
          handler(...(args as Parameters<typeof handler>)).pipe(
            Effect.mapError((cause) => new ServerFnOperationError({ cause })),
          ),
        ),
      );
      const unavailable =
        Promise.reject<ServerFnWireValue<Effect.Success<typeof effect>>>(directInvocationError());
      void unavailable.catch(() => undefined);

      return Object.assign(unavailable, {
        [ServerFnInvocationTypeId]: Object.freeze({ effect, identity, middleware }),
      });
    };

    return attachEFFRONTMember(serverFunction, identity, "ServerFn");
  },
});
