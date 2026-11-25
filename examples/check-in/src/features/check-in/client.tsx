"use client";

import { RegistryProvider } from "@effect/atom-react";
import type { JSX } from "react";
import { CheckInContent } from "./check-in-content.tsx";

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function CheckInConsole(): JSX.Element {
  return (
    <RegistryProvider>
      <CheckInContent />
    </RegistryProvider>
  );
}
