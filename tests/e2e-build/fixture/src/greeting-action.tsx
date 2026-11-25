"use client";

import type { JSX } from "react";
import { useActionState } from "react";
import { greet } from "./greet.ts";

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function GreetingAction(): JSX.Element {
  const [greeting, submit, pending] = useActionState(async () => greet("Ada"), "");
  return (
    <form action={submit}>
      <button disabled={pending} type="submit">
        Read greeting binding
      </button>
      <output data-testid="action-greeting">{greeting}</output>
    </form>
  );
}
