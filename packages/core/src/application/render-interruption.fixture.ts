import { Deferred, Effect, Exit, FiberSet, Ref, Scope } from "effect";

// oxlint-disable-next-line unicorn/no-null -- The authored React empty node exercises the same rendering input across fixtures.
export const emptyNode = null;

const observeCompletion = async (execution: Promise<unknown>): Promise<string> => {
  try {
    await execution;
    return "completed";
  } catch {
    return "interrupted";
  }
};

type Observation = Readonly<{ result: string; wasInterrupted: boolean }>;

export const makeInterruptionProbe = Effect.fnUntraced(function* () {
  const parent = yield* Effect.scope;
  const scope = yield* Scope.fork(parent);
  const started = yield* Deferred.make<boolean>();
  const interrupted = yield* Ref.make(false);
  const runtime = yield* FiberSet.makeRuntimePromise().pipe(Scope.provide(scope));
  const render = (): Effect.Effect<never> =>
    Deferred.succeed(started, true).pipe(
      Effect.andThen(Effect.never),
      Effect.onInterrupt(() => Ref.set(interrupted, true)),
    );
  const closeDuring = (execution: Promise<unknown>): Effect.Effect<Observation> =>
    Effect.gen(function* () {
      const observed = observeCompletion(execution);
      yield* Deferred.await(started);
      yield* Scope.close(scope, Exit.void);
      const result = yield* Effect.promise(async () => observed);
      const wasInterrupted = yield* Ref.get(interrupted);
      return { result, wasInterrupted };
    });

  return { closeDuring, render, runtime };
});
