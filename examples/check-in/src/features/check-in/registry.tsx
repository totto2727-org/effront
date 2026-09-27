"use client";

import { RegistryProvider as AtomRegistryProvider } from "@effect/atom-react";
import type { ReactNode } from "react";

export function RegistryProvider({ children }: { readonly children: ReactNode }) {
  return <AtomRegistryProvider>{children}</AtomRegistryProvider>;
}
