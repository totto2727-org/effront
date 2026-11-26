import type { Effect } from "effect";
import type { ReactNode } from "react";

import { attachEFFRONTMember } from "./effront-identity.ts";
import type { EFFRONTIdentity, EFFRONTMember } from "./effront-identity.ts";

export interface LoadingComponent<Services> extends EFFRONTMember<Services, "Loading"> {
  (): Awaited<ReactNode>;
}

type NonEffectOutput<Output> = [Extract<Output, Effect.Effect<unknown, unknown, unknown>>] extends [
  never,
]
  ? unknown
  : never;

type LoadingOptions<Output extends Awaited<ReactNode>> = Readonly<{
  render: (() => Output) & NonEffectOutput<Output>;
}>;

export type LoadingFactory<Services> = Readonly<{
  make: <Output extends Awaited<ReactNode>>(
    options: LoadingOptions<Output>,
  ) => LoadingComponent<Services>;
}>;

export const makeLoadingFactory = <Services>(
  identity: EFFRONTIdentity<Services>,
): LoadingFactory<Services> => ({
  make: ({ render }) => {
    const LoadingComponent = (): Awaited<ReactNode> => render();
    return attachEFFRONTMember(LoadingComponent, identity, "Loading");
  },
});
