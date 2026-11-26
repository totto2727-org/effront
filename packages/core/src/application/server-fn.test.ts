import { expect, it } from "@effect/vitest";
import { Context, Effect, Exit, Ref, Schema } from "effect";

import { ServerFnInputError } from "#core/rsc/server-fn-error.ts";

import { Application } from "./effront.ts";
import { getEFFRONTIdentity } from "./effront-identity.ts";
import { invocationEffect, nativeInvocation } from "./server-fn.fixture.ts";

class Greeting extends Context.Service<Greeting, Readonly<{ prefix: string }>>()(
  "effront/tests/application/server-fn/Greeting",
) {}

it.effect("rejects direct invocation in the server graph", () =>
  Effect.gen(function* () {
    const EFFRONT = Application.effront();
    const serverFn = EFFRONT.ServerFn.make({
      handler: Effect.succeed,
      input: Schema.String,
    });

    yield* Effect.promise(async () =>
      expect(serverFn("value")).rejects.toThrow(
        "An EFFRONT ServerFn is a framework intrinsic and cannot be invoked directly in the server graph.",
      ),
    );
  }),
);

it.effect("validates input and runs the handler with request services", () =>
  Effect.gen(function* () {
    const EFFRONT = Application.effront<Greeting>();
    const greet = EFFRONT.ServerFn.make({
      handler: Effect.fnUntraced(function* ({ name }) {
        const greeting = yield* Greeting;
        return `${greeting.prefix}, ${name}`;
      }),
      input: Schema.Struct({ name: Schema.NonEmptyString }),
    });

    const invocation: Promise<string> = greet({ name: "Nikhil" });
    const result = yield* invocationEffect(invocation, getEFFRONTIdentity(EFFRONT));

    expect(result).toBe("Hello, Nikhil");
  }).pipe(Effect.provideService(Greeting, { prefix: "Hello" })),
);

it.effect("decodes FormData before invoking a form action handler", () =>
  Effect.gen(function* () {
    const EFFRONT = Application.effront();
    const createGreeting = EFFRONT.ServerFn.make({
      handler: ({ name }) => Effect.succeed(`Hello, ${name}`),
      input: Schema.fromFormData(Schema.Struct({ name: Schema.NonEmptyString })),
    });
    const formData = new FormData();
    formData.set("name", "Nikhil");

    const invocation: Promise<string> = createGreeting(formData);
    const result = yield* invocationEffect(invocation, getEFFRONTIdentity(EFFRONT));

    expect(result).toBe("Hello, Nikhil");
  }),
);

it.effect("decodes previous state and FormData with request services", () =>
  Effect.gen(function* () {
    const EFFRONT = Application.effront<Greeting>();
    const greet = EFFRONT.ServerFn.make({
      handler: Effect.fnUntraced(function* (count, { name }) {
        const greeting = yield* Greeting;
        return `${greeting.prefix}, ${name}: ${count + 1}`;
      }),
      input: [
        Schema.FiniteFromString,
        Schema.fromFormData(Schema.Struct({ name: Schema.NonEmptyString })),
      ],
    });
    const form = new FormData();
    form.set("name", "Nikhil");
    const invocation: Promise<string> = greet("2", form);
    const result = yield* invocationEffect(invocation, getEFFRONTIdentity(EFFRONT));
    expect(result).toBe("Hello, Nikhil: 3");
  }).pipe(Effect.provideService(Greeting, { prefix: "Hello" })),
);

it.effect("keeps array and tuple Schemas as single arguments", () =>
  Effect.gen(function* () {
    const EFFRONT = Application.effront();
    const array = EFFRONT.ServerFn.make({
      handler: Effect.succeed,
      input: Schema.Array(Schema.String),
    });
    const tuple = EFFRONT.ServerFn.make({
      handler: Effect.succeed,
      input: Schema.Tuple([Schema.String, Schema.Finite]),
    });
    const arrayResult = yield* invocationEffect(
      array(["first", "second"]),
      getEFFRONTIdentity(EFFRONT),
    );
    const tupleResult = yield* invocationEffect(tuple(["first", 2]), getEFFRONTIdentity(EFFRONT));
    expect(arrayResult).toStrictEqual(["first", "second"]);
    expect(tupleResult).toStrictEqual(["first", 2]);
  }),
);

it.effect("preserves unary handling of omitted and extra native arguments", () =>
  Effect.gen(function* () {
    const EFFRONT = Application.effront();
    const action = EFFRONT.ServerFn.make({
      handler: () => Effect.succeed("done"),
      input: Schema.Undefined,
    });
    const identity = getEFFRONTIdentity(EFFRONT);
    const outputs = yield* Effect.forEach([[], [undefined, "ignored"]], (args) =>
      invocationEffect(nativeInvocation(action, args), identity),
    );
    expect(outputs).toStrictEqual(["done", "done"]);
  }),
);

it.effect("supports an empty argument list", () =>
  Effect.gen(function* () {
    const EFFRONT = Application.effront();
    const action = EFFRONT.ServerFn.make({ handler: () => Effect.succeed("done"), input: [] });
    const result = yield* invocationEffect(action(), getEFFRONTIdentity(EFFRONT));
    expect(result).toBe("done");
  }),
);

it.effect("rejects untrusted input before invoking the handler", () =>
  Effect.gen(function* () {
    const invoked = yield* Ref.make(false);
    const EFFRONT = Application.effront();
    const serverFn = EFFRONT.ServerFn.make({
      handler: Effect.fnUntraced(function* () {
        yield* Ref.set(invoked, true);
      }),
      input: Schema.Struct({ value: Schema.NonEmptyString }),
    });
    const exit = yield* Effect.exit(
      invocationEffect(serverFn({ value: "" }), getEFFRONTIdentity(EFFRONT)),
    );

    const invokedBeforeRender = yield* Ref.get(invoked);
    expect(Exit.isFailure(exit)).toBe(true);
    expect(invokedBeforeRender).toBe(false);
  }),
);

const formFor = (name: string): FormData => {
  const form = new FormData();
  form.set("name", name);
  return form;
};

it.effect("validates every positional argument before running the handler", () =>
  Effect.gen(function* () {
    const invoked = yield* Ref.make(false);
    const EFFRONT = Application.effront();
    const identity = getEFFRONTIdentity(EFFRONT);
    const action = EFFRONT.ServerFn.make({
      handler: () => Ref.set(invoked, true),
      input: [Schema.Finite, Schema.fromFormData(Schema.Struct({ name: Schema.NonEmptyString }))],
    });
    const invalidArguments = [["invalid state", formFor("Nikhil")], [0, new FormData()], [0], []];
    const exits = yield* Effect.forEach(invalidArguments, (args) =>
      Effect.exit(invocationEffect(nativeInvocation(action, args), identity)),
    );
    expect(exits.every((exit) => Exit.isFailure(exit))).toBe(true);
    expect(yield* Ref.get(invoked)).toBe(false);
  }),
);

it.effect("rejects extra native arguments for omitted input before running the handler", () =>
  Effect.gen(function* () {
    const invoked = yield* Ref.make(false);
    const EFFRONT = Application.effront();
    const action = EFFRONT.ServerFn.make({ handler: () => Ref.set(invoked, true) });
    const identity = getEFFRONTIdentity(EFFRONT);
    const failures = yield* Effect.forEach([["extra"], [undefined], [new FormData()]], (args) =>
      Effect.flip(invocationEffect(nativeInvocation(action, args), identity)),
    );
    expect(failures.every((error) => error instanceof ServerFnInputError)).toBe(true);
    expect(yield* Ref.get(invoked)).toBe(false);
  }),
);

it.effect("rejects extra native arguments for empty input before running the handler", () =>
  Effect.gen(function* () {
    const invoked = yield* Ref.make(false);
    const EFFRONT = Application.effront();
    const action = EFFRONT.ServerFn.make({ handler: () => Ref.set(invoked, true), input: [] });
    const identity = getEFFRONTIdentity(EFFRONT);
    const failures = yield* Effect.forEach([["extra"], [undefined], [new FormData()]], (args) =>
      Effect.flip(invocationEffect(nativeInvocation(action, args), identity)),
    );
    expect(failures.every((error) => error instanceof ServerFnInputError)).toBe(true);
    expect(yield* Ref.get(invoked)).toBe(false);
  }),
);
