import { Context, Effect, Option, Schema, Stream } from "effect";
import { useActionState } from "react";
import type { ReactNode } from "react";
import { expectTypeOf } from "vitest";

import { Application } from "#core/application/effront.ts";
import { query, stream, streamAtom } from "#core/query.ts";
import type { ServerFnError } from "#core/query.ts";

const EFFRONT = Application.effront();
const State = Schema.Struct({ count: Schema.Finite });
const Form = Schema.fromFormData(Schema.Struct({ name: Schema.NonEmptyString }));
const countIncrement = 1;
const sampleCount = 2;
const action = EFFRONT.ServerFn.make({
  handler: (previousState, form) => {
    expectTypeOf(previousState).not.toBeAny();
    expectTypeOf(form).not.toBeAny();
    const name: string = form.name;
    expectTypeOf(name);
    return Effect.succeed({ count: previousState.count + countIncrement });
  },
  input: [State, Form],
});
const result: Promise<Readonly<{ count: number }>> = action({ count: 0 }, new FormData());
expectTypeOf(result);
// @ts-expect-error The caller sends encoded FormData, not the decoded record.
expectTypeOf(action({ count: 0 }, { name: "Nikhil" }));
// @ts-expect-error Argument order is fixed by input.
expectTypeOf(action(new FormData(), { count: 0 }));
// @ts-expect-error Both arguments are required.
expectTypeOf(action({ count: 0 }));
// @ts-expect-error The declaration has exactly two arguments.
expectTypeOf(action({ count: 0 }, new FormData(), "extra"));

// oxlint-disable-next-line eslint/func-style -- The React preset requires a declaration for this hook-using type fixture.
export function ActionForm(): ReactNode {
  const [state, formAction] = useActionState(action, { count: 0 });
  return <form action={formAction}>{state.count}</form>;
}

const transformed = EFFRONT.ServerFn.make({
  handler: Effect.fn(function* (count, text) {
    const value: number = count;
    return yield* Effect.succeed(`${value}:${text}`);
  }),
  input: [Schema.FiniteFromString, Schema.String] as const,
});
const bound: (text: string) => Promise<string> = transformed.bind(undefined, "2");
expectTypeOf(bound);
// @ts-expect-error Caller uses the encoded number string.
expectTypeOf(transformed(sampleCount, "text"));

const tuple = EFFRONT.ServerFn.make({
  handler: Effect.succeed,
  input: Schema.Tuple([Schema.String, Schema.Finite]),
});
expectTypeOf(tuple(["text", sampleCount]));
// @ts-expect-error A Tuple Schema still describes one argument.
expectTypeOf(tuple("text", sampleCount));
const noArgs = EFFRONT.ServerFn.make({ handler: () => Effect.void, input: [] });
expectTypeOf(noArgs());
// @ts-expect-error An empty schema list declares no arguments.
expectTypeOf(noArgs("extra"));

const omittedInput = EFFRONT.ServerFn.make({ handler: () => Effect.succeed("done") });
expectTypeOf<Parameters<typeof omittedInput>>().toEqualTypeOf<[]>();
expectTypeOf<ReturnType<typeof omittedInput>>().toEqualTypeOf<Promise<string>>();
expectTypeOf(omittedInput());
// @ts-expect-error Omitted input declares no arguments.
expectTypeOf(omittedInput("extra"));
EFFRONT.ServerFn.make({
  // @ts-expect-error A handler cannot require arguments without an input schema.
  handler: (value: string) => Effect.succeed(value),
});
// @ts-expect-error An explicitly declared input schema must be provided at runtime.
EFFRONT.ServerFn.make<typeof Schema.String, string>({ handler: (value) => Effect.succeed(value) });
// @ts-expect-error An explicitly declared positional schema list must be provided at runtime.
EFFRONT.ServerFn.make<Readonly<[typeof Schema.String]>, string>({
  handler: (value) => Effect.succeed(value),
});
declare const optionalSchema: typeof Schema.String | undefined;
EFFRONT.ServerFn.make({
  handler: () => Effect.void,
  // @ts-expect-error Narrow uncertain schema presence before declaring a Server Function.
  input: optionalSchema,
});
const failingWithoutInput = EFFRONT.ServerFn.make({ handler: () => Effect.fail("failure") });
expectTypeOf<Parameters<typeof failingWithoutInput>>().toEqualTypeOf<[]>();
expectTypeOf(failingWithoutInput());

class DecoderService extends Context.Service<DecoderService, object>()(
  "effront/tests/types/server-fn/DecoderService",
) {}
const ServiceSchema = Schema.String.pipe(
  Schema.catchDecodingWithContext(() => Effect.map(DecoderService, () => Option.some("fallback"))),
);
EFFRONT.ServerFn.make({
  handler: () => Effect.void,
  // @ts-expect-error Every positional decoder must fit the service universe.
  input: [Schema.String, ServiceSchema],
});
const ProvideDecoder = EFFRONT.Middleware.make<{ provides: DecoderService }>((operation) =>
  operation.pipe(Effect.provideService(DecoderService, {})),
);
EFFRONT.withMiddleware(ProvideDecoder).ServerFn.make({
  handler: (first, second) => Effect.succeed(first + second),
  input: [Schema.String, ServiceSchema],
});

const streaming = EFFRONT.ServerFn.make({
  handler: () => Effect.succeed(Stream.make("one", "two")),
});
const streamedPromise: Promise<ReadableStream<string>> = streaming();
expectTypeOf(streamedPromise);
const readStreaming = stream(streaming);
const streamValue: Stream.Stream<string, ServerFnError> = readStreaming();
expectTypeOf(streamValue);
expectTypeOf(streamAtom(streaming));
// @ts-expect-error Streaming functions must use stream, not query.
expectTypeOf(query(streaming));
// @ts-expect-error Value functions must use query, not stream.
expectTypeOf(stream(omittedInput));
// @ts-expect-error A Stream must handle its own error channel.
EFFRONT.ServerFn.make({
  handler: () => Effect.succeed(Stream.fail("unhandled")),
});
// @ts-expect-error A Server Function cannot return either a Stream or a plain value.
EFFRONT.ServerFn.make({
  handler: (): Effect.Effect<Stream.Stream<number> | number> => Effect.succeed(sampleCount),
});
