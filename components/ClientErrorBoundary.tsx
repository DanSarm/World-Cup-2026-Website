"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** When set, failures are swallowed (for optional features like notifications). */
  silent?: boolean;
}

interface State {
  hasError: boolean;
}

/** Catches render errors so one client subtree cannot take down the whole app. */
export class ClientErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[ClientErrorBoundary]", error);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.silent) return null;
      return (
        <div className="mb-4 rounded-xl border border-canada/30 bg-canada/10 px-4 py-3 text-sm text-white/90">
          Something went wrong loading this section. Try refreshing the page.
        </div>
      );
    }

    return this.props.children;
  }
}
