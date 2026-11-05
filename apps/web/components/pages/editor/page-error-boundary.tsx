import { Component, Fragment } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { LayoutErrorFallback } from "@/components/common/layout-error-boundary";

type Props = { children: ReactNode };
type State = { hasError: boolean; retryKey: number };

/** Keep document failures inside the page so the workspace remains navigable. */
export class PageErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, retryKey: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Page editor crashed", error, info);
  }

  handleRetry = () => {
    this.setState((previous) => ({ hasError: false, retryKey: previous.retryKey + 1 }));
  };

  render() {
    if (this.state.hasError) return <LayoutErrorFallback onRetry={this.handleRetry} />;
    return <Fragment key={this.state.retryKey}>{this.props.children}</Fragment>;
  }
}
