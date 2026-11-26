"use client";

import type { JSX } from "react";
import { useActionState } from "react";
import { greet } from "./server.ts";

export const GreetingAction = (): JSX.Element => {
  const [greeting, submit, pending] = useActionState(async () => greet("Ada"), "");
  return (
    <form action={submit}>
      <button
        className="rounded border border-slate-400 bg-slate-100 px-4 py-2 disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        Call a Server Function
      </button>
      <output data-testid="action-greeting">{greeting}</output>
    </form>
  );
};
