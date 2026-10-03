import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-rose-500/50 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <h2 className="text-xl font-bold text-rose-400">පද්ධති දෝෂයක් (System Recovered)</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              දෝෂයක් හේතුවෙන් තිරය නැවත ආරම්භ විය යුතුය. කරුණාකර පහත බොත්තම ඔබන්න.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs transition-colors shadow-lg shadow-emerald-600/30"
            >
              නැවත පූරණය කරන්න (Reload App)
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
