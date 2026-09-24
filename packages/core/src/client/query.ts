import type { Effect } from "effect";
import { Atom } from "effect/unstable/reactivity";

import type { ServerFnError } from "../rsc/server-fn-error";
import { callQuery } from "./server-fn-protocol";

export const query = <Args extends ReadonlyArray<unknown>, Output>(
  serverFn: (...args: Args) => Promise<Output>,
) => (...args: Args): Effect.Effect<Output, ServerFnError> => callQuery(serverFn, args);

export const queryAtom = <Args extends ReadonlyArray<unknown>, Output>(
  serverFn: (...args: Args) => Promise<Output>,
): Atom.AtomResultFn<Args, Output, ServerFnError> =>
  Atom.fn((args: Args) => callQuery(serverFn, args));
