'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 * Catches React component errors and displays a fallback UI
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-[#0a0e17] text-white flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-[#0d1321] rounded-xl border border-red-500/30 p-8">
            <div className="flex items-start gap-4">
              <div className="text-4xl">⚠️</div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-red-400 mb-2">
                  Something went wrong
                </h1>
                <p className="text-gray-300 mb-4">
                  The dashboard encountered an unexpected error. Don&apos;t worry, your data is safe.
                </p>

                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <div className="bg-[#1a1f2e] rounded-lg p-4 mb-4 border border-red-500/20">
                    <p className="text-sm font-mono text-red-300 mb-2">
                      {this.state.error.toString()}
                    </p>
                    {this.state.errorInfo && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">
                          Stack Trace
                        </summary>
                        <pre className="text-xs text-gray-500 mt-2 overflow-auto max-h-48">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </details>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={this.handleReset}
                    className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-[#1e2738] hover:bg-[#2a3548] text-gray-300 rounded-lg font-medium transition-colors"
                  >
                    Reload Page
                  </button>
                </div>

                <div className="mt-6 pt-6 border-t border-[#1e2738]">
                  <p className="text-xs text-gray-500">
                    If this problem persists, please check:
                  </p>
                  <ul className="text-xs text-gray-500 mt-2 list-disc list-inside space-y-1">
                    <li>MT5 bridge is running (port 8080)</li>
                    <li>MT5 EA is attached to a chart</li>
                    <li>Browser console for additional errors</li>
                    <li>Network connectivity</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

