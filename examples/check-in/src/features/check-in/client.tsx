"use client";

import { RegistryProvider } from "@effect/atom-react";
import type { JSX } from "react";
import { CheckInContent } from "./check-in-content.tsx";

export const CheckInConsole = (): JSX.Element => (
  <RegistryProvider>
    <CheckInContent />
  </RegistryProvider>
);
