"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { BottomNav } from "@/components/BottomNav";
import { RulesModal } from "@/components/RulesModal";

const NotificationProvider = dynamic(
  () =>
    import("@/components/NotificationProvider").then(
      (m) => m.NotificationProvider
    ),
  { ssr: false }
);

interface ClientShellProps {
  isAdmin?: boolean;
  sessionActive: boolean;
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

class ShellErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ClientShell error:", error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return this.props.children;
    }
    return this.props.children;
  }
}

export function ClientShell({
  isAdmin,
  sessionActive,
  children,
}: ClientShellProps) {
  return (
    <>
      {sessionActive && (
        <ShellErrorBoundary>
          <div className="max-w-2xl mx-auto">
            <NotificationProvider enabled={sessionActive} />
          </div>
        </ShellErrorBoundary>
      )}
      {children}
      <BottomNav isAdmin={isAdmin} />
      <div className="md:hidden fixed top-4 right-4 z-30">
        {sessionActive && <RulesModal variant="mobile" />}
      </div>
    </>
  );
}
