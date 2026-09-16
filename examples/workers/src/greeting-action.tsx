"use client";

import { useActionState } from "react";
import { greet } from "./greet";

export function GreetingAction() {
  const [greeting, submit, pending] = useActionState(() => greet("Ada"), "");
  return (
    <form action={submit}>
      <button disabled={pending}>Read KV through a Server Function</button>
      <output data-testid="action-greeting">{greeting}</output>
    </form>
  );
}
