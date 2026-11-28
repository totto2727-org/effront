import { Application } from "@effront/core";
import { Effect } from "effect";

export const EFFRONT = Application.effront();

export const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="en">
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </head>
        <body>{children}</body>
      </html>,
    ),
});
