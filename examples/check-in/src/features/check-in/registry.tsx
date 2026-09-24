"use client";

import { RegistryProvider as AtomRegistryProvider } from "@effect/atom-react";
import type { ReactNode } from "react";

export function RegistryProvider({ children }: { readonly children: ReactNode }) {
  // atom-react has no react-server export condition. Its provider uses React browser hooks,
  // so SSR must use its documented default standalone registry and the browser owns the provider.
  if (typeof window === "undefined") return children;
  return <AtomRegistryProvider>{children}</AtomRegistryProvider>;
}
