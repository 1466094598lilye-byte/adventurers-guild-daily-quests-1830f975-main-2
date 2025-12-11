import React from 'react';
import { AlertTriangle } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // 忽略 WebSocket 错误（这些会自动重连）
    if (error.message && error.message.includes('WebSocket')) {
      console.warn('WebSocket error caught and ignored:', error);
      this.setState({ hasError: false, error: null });
      return;
    }
    
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error && !this.state.error.message?.includes('WebSocket')) {
      return (
        <div 
          className="min-h-screen flex items-center justify-center p-4"
          style={{ backgroundColor: '#F9FAFB' }}
        >
          <div 
            className="max-w-md w-full p-8 text-center"
            style={{
              backgroundColor: '#FF6B35',
              border: '5px solid #000',
              boxShadow: '10px 10px 0px #000'
            }}
          >
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-white" strokeWidth={3} />
            <h2 className="text-2xl font-black uppercase text-white mb-4">
              Oops! Something went wrong
            </h2>
            <p className="font-bold text-white mb-6">
              {this.state.error.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 font-black uppercase"
              style={{
                backgroundColor: '#FFE66D',
                border: '4px solid #000',
                boxShadow: '5px 5px 0px #000'
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;