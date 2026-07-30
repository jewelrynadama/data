// src/components/ErrorBoundary.tsx
import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  pageName?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error in', this.props.pageName ?? 'component', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: 320,
          gap: 16,
          padding: 32,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            Halaman {this.props.pageName ?? ''} Mengalami Error
          </div>
          <div style={{
            fontSize: 13,
            color: 'var(--text-muted)',
            maxWidth: 480,
            lineHeight: 1.6,
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 8,
            padding: '12px 16px',
            fontFamily: 'monospace',
            wordBreak: 'break-word',
          }}>
            {this.state.error?.message ?? 'Unknown error'}
          </div>
          <button
            className="btn btn-primary"
            onClick={this.handleReset}
          >
            🔄 Coba Lagi
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
