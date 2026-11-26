import { Effect, Schema } from "effect";
import { Application } from "./effront.ts";

export const EFFRONT = Application.effront();
export const Shell = EFFRONT.Layout.make({
  render: ({ children }) => Effect.succeed(<main>{children}</main>),
});

export const HomePage = EFFRONT.Page.make({ render: () => Effect.succeed(<h1>Home</h1>) });
export const SlugPage = EFFRONT.Page.make({
  params: Schema.Struct({ slug: Schema.String }),
  render: ({ params }) => Effect.succeed(<h1>{params.slug}</h1>),
});
export const NestedParamsPage = EFFRONT.Page.make({
  params: Schema.Struct({ b: Schema.String, d: Schema.String }),
  render: ({ params }) =>
    Effect.succeed(
      <h1>
        {params.b}/{params.d}
      </h1>,
    ),
});
