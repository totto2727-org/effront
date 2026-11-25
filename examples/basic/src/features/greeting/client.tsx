"use client";

import type { JSX } from "react";
import { useActionState } from "react";
import { greet } from "./server.ts";

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function GreetingAction(): JSX.Element {
  const [greeting, submit, pending] = useActionState(async () => greet("Ada"), "");
  return (
    <form action={submit}>
      <button
        className="rounded border border-slate-400 bg-slate-100 px-4 py-2 disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        Read KV through a Server Function
      </button>
      <output data-testid="action-greeting">{greeting}</output>
    </form>
  );
}
