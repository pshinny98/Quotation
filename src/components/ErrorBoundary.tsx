import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    (this as any).state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    const state = (this as any).state;
    if (state.hasError) {
      let errorMessage = 'An unexpected error occurred.';
      let errorDetails = '';

      try {
        if (state.error?.message) {
          const parsedError = JSON.parse(state.error.message);
          if (parsedError.error) {
            errorMessage = `Firestore Error: ${parsedError.error}`;
            errorDetails = `Operation: ${parsedError.operationType} on ${parsedError.path}`;
          }
        }
      } catch (e) {
        errorMessage = state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-surface p-4 font-body">
          <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-lg max-w-md w-full border border-error/20">
            <h2 className="text-2xl font-headline font-bold text-error mb-4">Something went wrong</h2>
            <p className="text-on-surface-variant mb-4">{errorMessage}</p>
            {errorDetails && (
              <p className="text-xs text-on-surface-variant/70 bg-surface-container-low p-3 rounded font-mono mb-6">
                {errorDetails}
              </p>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full h-12 rounded-md bg-primary text-on-primary font-label font-bold tracking-wide shadow-md hover:opacity-90 transition-opacity"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }

}
