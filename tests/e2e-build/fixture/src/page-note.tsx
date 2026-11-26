"use client";

import type { ChangeEvent, JSX } from "react";
import { useCallback, useState } from "react";

export const PageNote = (): JSX.Element => {
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
};
