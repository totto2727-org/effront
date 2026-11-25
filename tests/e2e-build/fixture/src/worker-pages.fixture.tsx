import { Effect } from "effect";
import { Counter } from "./counter.tsx";
import { EFFRONT } from "./effront.ts";
import { GreetingAction } from "./greeting-action.tsx";
import { getWorkersEnv, getWorkersRequestContext } from "./host.ts";

export const HomePage = EFFRONT.Page.make({
  render: Effect.fn("HomePage.render")(function* () {
    const env = yield* getWorkersEnv();
    return (
      <>
        <h1>{env.APP_LABEL}</h1>
        <p data-testid="secret-status">
          {(env.SERVER_TOKEN ?? "").length > "".length
            ? "Server secret configured"
            : "No server secret"}
        </p>
        <p>React Server Components on Workers, powered by Effect.</p>
        <Counter />
        <GreetingAction />
      </>
    );
  }),
});

export const AboutPage = EFFRONT.Page.make({
  render: Effect.fn("AboutPage.render")(function* () {
    const context = yield* getWorkersRequestContext();
    context.executionContext.waitUntil(Promise.resolve());
    const env = yield* getWorkersEnv();
    return (
      <>
        <h1>About</h1>
        <p data-testid="label">{env.APP_LABEL}</p>
        <a href="/">Back home</a>
      </>
    );
  }),
});
