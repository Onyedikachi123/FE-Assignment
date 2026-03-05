'use client';

import React from 'react';

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

/**
 * ErrorBoundary
 *
 * Wraps the tldraw canvas to prevent a full-page crash if the editor
 * encounters an unexpected runtime error. Renders a user-friendly
 * recovery UI instead of a blank screen.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    override componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[ErrorBoundary] Canvas crashed:', error, info.componentStack);
    }

    override render() {
        if (this.state.hasError) {
            return (
                this.props.fallback ?? (
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#0f172a',
                            color: '#94a3b8',
                            fontFamily: 'system-ui, sans-serif',
                            gap: 16,
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={1.5}>
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <h2 style={{ color: '#f1f5f9', margin: 0, fontSize: 20, fontWeight: 700 }}>
                            Canvas crashed
                        </h2>
                        <p style={{ margin: 0, fontSize: 14, maxWidth: 400, textAlign: 'center' }}>
                            {this.state.error?.message ?? 'An unexpected error occurred in the canvas.'}
                        </p>
                        <button
                            onClick={() => this.setState({ hasError: false, error: null })}
                            style={{
                                background: '#6366f1',
                                color: 'white',
                                border: 'none',
                                borderRadius: 8,
                                padding: '10px 20px',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: 14,
                            }}
                        >
                            Try to recover
                        </button>
                    </div>
                )
            );
        }

        return this.props.children;
    }
}
