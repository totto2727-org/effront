"use client";

import type { JSX } from "react";
import { useActionState } from "react";
import { greet } from "./greet.ts";

export const GreetingAction = (): JSX.Element => {
  const [greeting, submit, pending] = useActionState(async () => greet("Ada"), "");
  return (
    <form action={submit}>
      <button disabled={pending} type="submit">
        Read greeting binding
      </button>
      <output data-testid="action-greeting">{greeting}</output>
    </form>
  );
};
