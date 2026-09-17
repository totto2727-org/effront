import { Effect } from "effect";
import { EFFRONT } from "./effront";
import { GreetingAction } from "./greeting-action";
import { Host, HostLive } from "./host";
import { Counter } from "./counter";
import { ExampleShell, PageNote, TransitionExampleLayout } from "./example-shell";

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="en">
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Effront Workers</title>
        </head>
        <body className="m-8 bg-slate-50 font-sans text-blue-950">
          <ExampleShell>{children}</ExampleShell>
        </body>
      </html>,
    ),
});

const HomePage = EFFRONT.Page.make({
  render: Effect.fn("HomePage.render")(function* () {
    const host = yield* Host;
    return (
      <>
        <h1 className="my-5 text-3xl font-bold">{host.label}</h1>
        <p className="my-4" data-testid="kv-greeting">
          {host.greeting}
        </p>
        <p className="my-4">React Server Components on Workers, powered by Effect.</p>
        <Counter />
        <GreetingAction />
      </>
    );
  }),
});

const AboutPage = EFFRONT.Page.make({
  render: Effect.fn("AboutPage.render")(function* () {
    const host = yield* Host;
    return (
      <>
        <h1 className="my-5 text-3xl font-bold">About</h1>
        <p className="my-4" data-testid="label">
          {host.label}
        </p>
        <a className="text-blue-700 underline" href="/">
          Back home
        </a>
      </>
    );
  }),
});

const TransitionLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(<TransitionExampleLayout>{children}</TransitionExampleLayout>),
});

const transitionPage = (mode: "default" | "custom" | "typed" | "disabled", step: "a" | "b") =>
  EFFRONT.Page.make({
    ...(mode === "custom"
      ? { viewTransition: { default: "demo-slide" } }
      : mode === "typed"
        ? { viewTransition: { default: { default: "demo-slide", "demo-navigation": "demo-lift" } } }
        : mode === "disabled"
          ? { viewTransition: false as const }
          : {}),
    render: () =>
      Effect.succeed(
        <section
          className={
            step === "a" ? "mt-8 rounded-2xl bg-blue-100 p-8" : "mt-8 rounded-2xl bg-indigo-100 p-8"
          }
        >
          <h1 className="my-5 text-3xl font-bold">{`${mode} page ${step.toUpperCase()}`}</h1>
          <p className="my-4">
            {mode === "default"
              ? "Effront animates this page with its built-in transition, without configuration."
              : mode === "custom"
                ? "This page selects a custom transition class and supplies its animation in CSS."
                : mode === "typed"
                  ? "The next link selects a lift animation. Browser history uses the fallback slide animation."
                  : "This page opts out of the built-in page transition."}
          </p>
          <PageNote />
          <a
            className="text-blue-700 underline"
            href={`/transitions/${mode}-${step === "a" ? "b" : "a"}`}
            data-effront-transition-types={mode === "typed" ? "demo-navigation" : undefined}
          >
            Next example page
          </a>
        </section>,
      ),
  });

const transitionRoutes = EFFRONT.Routes.make({ layout: TransitionLayout })
  .page("/default-a", transitionPage("default", "a"))
  .page("/default-b", transitionPage("default", "b"))
  .page("/custom-a", transitionPage("custom", "a"))
  .page("/custom-b", transitionPage("custom", "b"))
  .page("/typed-a", transitionPage("typed", "a"))
  .page("/typed-b", transitionPage("typed", "b"))
  .page("/disabled-a", transitionPage("disabled", "a"))
  .page("/disabled-b", transitionPage("disabled", "b"));

export default EFFRONT.make({
  layer: HostLive,
  routes: EFFRONT.Routes.make({ layout: RootLayout })
    .page("/", HomePage)
    .page("/about", AboutPage)
    .mount("/transitions", transitionRoutes),
});
