import { Effect } from "effect";
import { EFFRONT, RootLayout } from "./layout";

const HomePage = EFFRONT.Page.make({ render: () => Effect.succeed(<h1>Backoffice</h1>) });

export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage),
});
