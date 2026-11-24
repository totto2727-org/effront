import { Context, Effect, Layer, Schema } from "effect";
import { Component, StrictMode, useLayoutEffect, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";

import type { FlightPayload } from "#core/rsc/flight.ts";
import { BrowserEffectRunner } from "./browser-effect-runner.ts";
import { BrowserRenderStatus } from "./browser-render-status.ts";
import { BrowserRenderer } from "./browser-renderer.ts";
import type { BrowserRender } from "./browser-renderer.ts";
import { BrowserFailureScreen } from "./browser-screen.tsx";
import { RouteTree } from "./route-tree.tsx";

export class ReactDOMHydrationError extends Schema.TaggedError<ReactDOMHydrationError>()(
  "ReactDOMHydrationError",
  { cause: Schema.Defect() },
) {}

type BrowserErrorBoundaryState =
  | Readonly<{ _tag: "Uninitialized" }>
  | Readonly<{ _tag: "Ready"; render: BrowserRender }>
  | Readonly<{ _tag: "Failed"; render: BrowserRender }>;
type BrowserErrorBoundaryProps = Readonly<{
  children: ReactNode;
  onError: (error: unknown, info: ErrorInfo) => void;
  onRendered: () => void;
  render: BrowserRender;
}>;

class BrowserErrorBoundary extends Component<BrowserErrorBoundaryProps, BrowserErrorBoundaryState> {
  override readonly state: BrowserErrorBoundaryState = { _tag: "Uninitialized" };

  static getDerivedStateFromError() {
    return { _tag: "Failed" } as const;
  }

  static getDerivedStateFromProps(
    props: BrowserErrorBoundaryProps,
    state: BrowserErrorBoundaryState,
  ): BrowserErrorBoundaryState | null {
    if (state._tag !== "Uninitialized" && props.render === state.render) {
      return null;
    }
    // Discard acknowledges a cancelled candidate, not a request to retry the failed tree.
    return state._tag === "Failed" && props.render._tag === "Discard"
      ? { _tag: "Failed", render: props.render }
      : { _tag: "Ready", render: props.render };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    this.props.onError(error, info);
  }

  override componentDidMount(): void {
    if (this.state._tag === "Ready") {
      this.props.onRendered();
    }
  }

  override componentDidUpdate(): void {
    if (this.state._tag === "Ready") {
      this.props.onRendered();
    }
  }

  override render() {
    if (this.state._tag === "Failed") {
      return <BrowserFailureScreen />;
    }

    return this.props.children;
  }
}

export class ReactDOMRenderer extends Context.Service<ReactDOMRenderer>()(
  "effront/client/ReactDOMRenderer",
  {
    make: Effect.gen(function* () {
      const browserRenderer = yield* BrowserRenderer;
      const run = yield* BrowserEffectRunner;
      const renderStatus = yield* BrowserRenderStatus;

      const hydrate = Effect.fnUntraced(function* (
        container: Element | Document,
        initialPayload: FlightPayload,
      ) {
        const browserRendererReady = Promise.withResolvers<void>();
        const reportError = (error: unknown, info: ErrorInfo): void => {
          void run(
            Effect.gen(function* () {
              yield* renderStatus.report({
                _tag: "Failed",
                error,
                componentStack: info.componentStack ?? null,
              });
              yield* Effect.logError("Uncaught client render error.", error, info.componentStack);
            }),
          );
        };

        const reportRendered = (): void => {
          void run(renderStatus.report({ _tag: "Rendered" }));
        };

        function Root() {
          const [render, setRender] = useState<BrowserRender>(() => ({
            _tag: "Initial",
            routeTree: initialPayload.routeTree,
          }));

          useLayoutEffect(() => {
            browserRenderer.initialize(initialPayload.routeTree, setRender);
            browserRendererReady.resolve();
          }, []);

          useLayoutEffect(() => {
            browserRenderer.commit(render);
          }, [render]);

          const routeTree = render._tag === "Discard" ? render.restore.routeTree : render.routeTree;
          return (
            <BrowserErrorBoundary onError={reportError} onRendered={reportRendered} render={render}>
              <RouteTree root={routeTree} />
            </BrowserErrorBoundary>
          );
        }

        yield* Effect.acquireRelease(
          Effect.try({
            catch: (cause) => new ReactDOMHydrationError({ cause }),
            try: () =>
              hydrateRoot(
                container,
                <StrictMode>
                  <Root />
                </StrictMode>,
                { formState: initialPayload.formState },
              ),
          }),
          (root) => Effect.sync(() => root.unmount()),
        );
        yield* Effect.promise(() => browserRendererReady.promise);
      });

      return { hydrate };
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
