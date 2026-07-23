import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Unhandled UI error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-crash">
          <h1>Something went wrong</h1>
          <pre>{this.state.error.message}</pre>
          <button onClick={() => this.setState({ error: null })}>Dismiss</button>
        </div>
      );
    }

    return this.props.children;
  }
}
