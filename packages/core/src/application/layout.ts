import { Effect } from "effect";
import type { ReactNode } from "react";

import { attachEFFRONTMember } from "./effront-identity.ts";
import type { EFFRONTIdentity, EFFRONTMember } from "./effront-identity.ts";
import type { AnyMiddleware } from "./middleware.ts";

type LayoutProps = Readonly<{
  children: Awaited<ReactNode>;
}>;

export interface LayoutComponent<ApplicationServices> extends EFFRONTMember<
  ApplicationServices,
  "Layout"
> {
  (props: LayoutProps): Promise<Awaited<ReactNode>>;
}

type LayoutOptions<Error, AvailableServices> = Readonly<{
  render: (props: LayoutProps) => Effect.Effect<Awaited<ReactNode>, Error, AvailableServices>;
}>;

export type LayoutFactory<ApplicationServices, AvailableServices> = Readonly<{
  make: <Error>(
    options: LayoutOptions<Error, AvailableServices>,
  ) => LayoutComponent<ApplicationServices>;
}>;

export const makeLayoutFactory = <ApplicationServices, AvailableServices>(
  identity: EFFRONTIdentity<ApplicationServices>,
  middleware: Readonly<AnyMiddleware<ApplicationServices>[]>,
): LayoutFactory<ApplicationServices, AvailableServices> => ({
  make: ({ render }) => {
    const LayoutComponent = (props: LayoutProps) =>
      identity.renderRuntime.run(
        "Layout",
        Effect.suspend(() => render(props)),
        middleware,
      );

    return attachEFFRONTMember(LayoutComponent, identity, "Layout");
  },
});
