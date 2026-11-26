import { Effect } from "effect";
import { EFFRONT } from "./effront.ts";
import { PageNote } from "./page-note.tsx";
import { TransitionExampleLayout } from "./transition-example-layout.tsx";

const TransitionLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(<TransitionExampleLayout>{children}</TransitionExampleLayout>),
});

const descriptions = {
  custom: "This page selects a custom transition class and supplies its animation in CSS.",
  default: "Effront animates this page with its built-in transition, without configuration.",
  disabled: "This page opts out of the built-in page transition.",
  typed:
    "The next link selects a lift animation. Browser history uses the fallback slide animation.",
};

const effects = {
  custom: { viewTransition: { default: "demo-slide" } },
  default: {},
  disabled: { viewTransition: false },
  typed: { viewTransition: { default: { default: "demo-slide", "demo-navigation": "demo-lift" } } },
} as const;

type Mode = keyof typeof effects;
type Step = "a" | "b";

const transitionPage = (mode: Mode, step: Step): ReturnType<typeof EFFRONT.Page.make> =>
  EFFRONT.Page.make({
    ...effects[mode],
    render: () =>
      Effect.succeed(
        <section className={`transition-card transition-card-${step}`}>
          <h1>{`${mode} page ${step.toUpperCase()}`}</h1>
          <p>{descriptions[mode]}</p>
          <PageNote />
          <a
            href={`/transitions/${mode}-${step === "a" ? "b" : "a"}`}
            data-effront-transition-types={mode === "typed" ? "demo-navigation" : undefined}
          >
            Next example page
          </a>
        </section>,
      ),
  });

export const transitionRoutes = EFFRONT.Routes.make({ layout: TransitionLayout })
  .page("/default-a", transitionPage("default", "a"))
  .page("/default-b", transitionPage("default", "b"))
  .page("/custom-a", transitionPage("custom", "a"))
  .page("/custom-b", transitionPage("custom", "b"))
  .page("/typed-a", transitionPage("typed", "a"))
  .page("/typed-b", transitionPage("typed", "b"))
  .page("/disabled-a", transitionPage("disabled", "a"))
  .page("/disabled-b", transitionPage("disabled", "b"));
