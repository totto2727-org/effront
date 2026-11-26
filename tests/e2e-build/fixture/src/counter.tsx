"use client";

import type { JSX } from "react";
import { useCallback, useState } from "react";

const initialCount = 0;
const increment = 1;

export const Counter = (): JSX.Element => {
  const [count, setCount] = useState(initialCount);
  const incrementCount = useCallback(() => {
    setCount((value) => value + increment);
  }, []);
  return (
    <button onClick={incrementCount} type="button">
      Count: {count}
    </button>
  );
};
