import { Option } from "effect";
import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

import { isDiscard } from "./browser-renderer-model.ts";
import type { BrowserRender } from "./browser-renderer-model.ts";
import { BrowserFailureScreen } from "./browser-screen.tsx";

type BoundaryState = Readonly<{
  failed: boolean;
  render: Option.Option<BrowserRender>;
}>;

export type BrowserRenderObservers = Readonly<{
  onError: (error: unknown, info: ErrorInfo) => void;
  onRendered: () => void;
}>;

type BoundaryProps = BrowserRenderObservers &
  Readonly<{
    children: ReactNode;
    render: BrowserRender;
  }>;

export class BrowserErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  public constructor(props: BoundaryProps) {
    super(props);
    this.state = { failed: false, render: Option.none() };
  }

  public static getDerivedStateFromError(): Pick<BoundaryState, "failed"> {
    return { failed: true };
  }

  public static getDerivedStateFromProps(
    { render }: BoundaryProps,
    state: BoundaryState,
  ): BoundaryState | null {
    if (Option.exists(state.render, (previous) => previous === render)) {
      // oxlint-disable-next-line unicorn/no-null -- React requires null to retain the boundary state.
      return null;
    }
    // A discard acknowledges cancellation without retrying the failed tree.
    return { failed: state.failed && isDiscard(render), render: Option.some(render) };
  }

  public override componentDidCatch(error: unknown, info: ErrorInfo): void {
    this.props.onError(error, info);
  }

  public override componentDidMount(): void {
    this.reportIfRendered();
  }

  public override componentDidUpdate(): void {
    this.reportIfRendered();
  }

  private reportIfRendered(): void {
    if (!this.state.failed && Option.isSome(this.state.render)) {
      this.props.onRendered();
    }
  }

  public override render(): ReactNode {
    return this.state.failed ? <BrowserFailureScreen /> : this.props.children;
  }
}
