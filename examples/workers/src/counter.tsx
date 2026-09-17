"use client";

import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button
      className="rounded border border-slate-400 bg-slate-100 px-4 py-2"
      onClick={() => setCount((value) => value + 1)}
    >
      Count: {count}
    </button>
  );
}
