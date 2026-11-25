"use client";

import type { ChangeEvent, JSX } from "react";
import { useCallback, useState } from "react";

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function PageNote(): JSX.Element {
  const [note, setNote] = useState("");
  const update = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setNote(event.target.value);
  }, []);
  const label = (
    <label>
      Page note <input onChange={update} value={note} />
    </label>
  );
  return <p>{label}</p>;
}
