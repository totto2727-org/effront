import { Effect, Layer } from "effect";
import { CheckInConsole } from "./features/check-in/client";
import { CheckInStore } from "./features/check-in/services";
import { EFFRONT } from "./effront";

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="en">
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Effront event check-in</title>
        </head>
        <body>
          <main>{children}</main>
        </body>
      </html>,
    ),
});

const CheckInPage = EFFRONT.Page.make({
  render: Effect.fn("CheckInPage.render")(() => Effect.succeed(<CheckInConsole />)),
});

export default EFFRONT.make({
  layer: Layer.effect(CheckInStore, CheckInStore),
  routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/", CheckInPage),
});
