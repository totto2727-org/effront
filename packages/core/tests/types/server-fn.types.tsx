import { Context, Effect, Option, Schema, Stream } from "effect";
import { useActionState } from "react";
import { expectTypeOf } from "vitest";

import { Application } from "../../src/application/effront";
import { query, stream, streamAtom, type ServerFnError } from "../../src/query";

const EFFRONT = Application.effront();
const State = Schema.Struct({ count: Schema.Finite });
const Form = Schema.fromFormData(Schema.Struct({ name: Schema.NonEmptyString }));
const action = EFFRONT.ServerFn.make({
  input: [State, Form],
  handler: (previousState, form) => {
    const stateIsNotAny: 0 extends 1 & typeof previousState ? false : true = true;
    const formIsNotAny: 0 extends 1 & typeof form ? false : true = true;
    void stateIsNotAny;
    void formIsNotAny;
    const name: string = form.name;
    void name;
    return Effect.succeed({ count: previousState.count + 1 });
  },
});
const result: Promise<{ readonly count: number }> = action({ count: 0 }, new FormData());
void result;
// @ts-expect-error The caller sends encoded FormData, not the decoded record.
void action({ count: 0 }, { name: "Nikhil" });
// @ts-expect-error Argument order is fixed by input.
void action(new FormData(), { count: 0 });
// @ts-expect-error Both arguments are required.
void action({ count: 0 });
// @ts-expect-error The declaration has exactly two arguments.
void action({ count: 0 }, new FormData(), "extra");

function ActionForm() {
  const [state, formAction] = useActionState(action, { count: 0 });
  return <form action={formAction}>{state.count}</form>;
}
void ActionForm;

const transformed = EFFRONT.ServerFn.make({
  input: [Schema.FiniteFromString, Schema.String] as const,
  handler: Effect.fn(function* (count, text) {
    const value: number = count;
    return yield* Effect.succeed(`${value}:${text}`);
  }),
});
const bound: (text: string) => Promise<string> = transformed.bind(null, "2");
void bound;
// @ts-expect-error Caller uses the encoded number string.
void transformed(2, "text");

const tuple = EFFRONT.ServerFn.make({
  input: Schema.Tuple([Schema.String, Schema.Finite]),
  handler: Effect.succeed,
});
void tuple(["text", 2]);
// @ts-expect-error A Tuple Schema still describes one argument.
void tuple("text", 2);
const noArgs = EFFRONT.ServerFn.make({ input: [], handler: () => Effect.void });
void noArgs();
// @ts-expect-error An empty schema list declares no arguments.
void noArgs("extra");

const omittedInput = EFFRONT.ServerFn.make({ handler: () => Effect.succeed("done") });
expectTypeOf<Parameters<typeof omittedInput>>().toEqualTypeOf<[]>();
expectTypeOf<ReturnType<typeof omittedInput>>().toEqualTypeOf<Promise<string>>();
void omittedInput();
// @ts-expect-error Omitted input declares no arguments.
void omittedInput("extra");
EFFRONT.ServerFn.make({
  // @ts-expect-error A handler cannot require arguments without an input schema.
  handler: (value: string) => Effect.succeed(value),
});
// @ts-expect-error An explicitly declared input schema must be provided at runtime.
EFFRONT.ServerFn.make<typeof Schema.String, string>({ handler: (value) => Effect.succeed(value) });
// @ts-expect-error An explicitly declared positional schema list must be provided at runtime.
EFFRONT.ServerFn.make<readonly [typeof Schema.String], string>({
  handler: (value) => Effect.succeed(value),
});
declare const optionalSchema: typeof Schema.String | undefined;
EFFRONT.ServerFn.make({
  // @ts-expect-error Narrow uncertain schema presence before declaring a Server Function.
  input: optionalSchema,
  handler: () => Effect.void,
});
const failingWithoutInput = EFFRONT.ServerFn.make({ handler: () => Effect.fail("failure") });
expectTypeOf<Parameters<typeof failingWithoutInput>>().toEqualTypeOf<[]>();
void failingWithoutInput();

class DecoderService extends Context.Service<DecoderService, object>()(
  "effront/tests/types/server-fn/DecoderService",
) {}
const ServiceSchema = Schema.String.pipe(
  Schema.catchDecodingWithContext(() => Effect.map(DecoderService, () => Option.some("fallback"))),
);
EFFRONT.ServerFn.make({
  // @ts-expect-error Every positional decoder must fit the service universe.
  input: [Schema.String, ServiceSchema],
  handler: () => Effect.void,
});
const ProvideDecoder = EFFRONT.Middleware.make<{ provides: DecoderService }>((operation) =>
  operation.pipe(Effect.provideService(DecoderService, {})),
);
EFFRONT.withMiddleware(ProvideDecoder).ServerFn.make({
  input: [Schema.String, ServiceSchema],
  handler: (first, second) => Effect.succeed(first + second),
});

const streaming = EFFRONT.ServerFn.make({
  handler: () => Effect.succeed(Stream.make("one", "two")),
});
const streamedPromise: Promise<ReadableStream<string>> = streaming();
void streamedPromise;
const readStreaming = stream(streaming);
const streamValue: Stream.Stream<string, ServerFnError> = readStreaming();
void streamValue;
void streamAtom(streaming);
// @ts-expect-error Streaming functions must use stream, not query.
void query(streaming);
// @ts-expect-error Value functions must use query, not stream.
void stream(omittedInput);
// @ts-expect-error A Stream must handle its own error channel.
EFFRONT.ServerFn.make({
  handler: () => Effect.succeed(Stream.fail("unhandled")),
});
// @ts-expect-error A Server Function cannot return either a Stream or a plain value.
EFFRONT.ServerFn.make({
  handler: (): Effect.Effect<Stream.Stream<number> | number> => Effect.succeed(1),
});
