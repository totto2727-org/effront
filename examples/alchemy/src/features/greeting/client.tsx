"use client";

import { useActionState } from "react";
import { greet } from "./server";

export function GreetingAction() {
  const [greeting, submit, pending] = useActionState(() => greet("Ada"), "");
  return (
    <form action={submit}>
      <button
        className="rounded border border-slate-400 bg-slate-100 px-4 py-2 disabled:opacity-50"
        disabled={pending}
      >
        Read KV through a Server Function
      </button>
      <output data-testid="action-greeting">{greeting}</output>
    </form>
  );
}
