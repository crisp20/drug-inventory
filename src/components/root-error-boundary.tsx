import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button.tsx";
import {
  ErrorState,
  ErrorStateContent,
  ErrorStateDescription,
  ErrorStateHeader,
  ErrorStateMedia,
  ErrorStateTitle,
} from "@/components/ui/error-state.tsx";
import { errorMessage } from "@/lib/errors.ts";

type Props = { children: ReactNode };
type State = { error: unknown };

export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <ErrorState>
            <ErrorStateHeader>
              <ErrorStateMedia variant="icon" />
              <ErrorStateTitle>Something went wrong</ErrorStateTitle>
              <ErrorStateDescription>
                {errorMessage(this.state.error, "We could not load this page.")}
              </ErrorStateDescription>
            </ErrorStateHeader>
            <ErrorStateContent>
              <Button onClick={() => this.setState({ error: null })}>Try again</Button>
            </ErrorStateContent>
          </ErrorState>
        </div>
      );
    }
    return this.props.children;
  }
}
