import React, {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// React Error Boundary to catch unexpected UI crashes and show a recovery button
interface ErrorBoundaryProps {
  children: React.ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: ErrorBoundaryProps;
  declare state: ErrorBoundaryState;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error Caught by Boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-xl font-bold text-amber-400">Ocorreu um erro ao carregar o aplicativo</h2>
            <p className="text-sm text-slate-300">
              Ocorreu uma inconsistência temporária de exibição. Clique no botão abaixo para recarregar o app.
            </p>
            <p className="text-xs text-slate-500 font-mono bg-slate-950 p-2 rounded text-left overflow-x-auto">
              {this.state.error?.message || 'Erro de execução'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl transition-all"
            >
              Recarregar Aplicativo
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}




// Service Worker Management
if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    // In Development (AI Studio Preview), UNREGISTER service workers to prevent white screen caching issues
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
        console.log('Development mode: Unregistered active ServiceWorker to ensure clean live updates.');
      }
    });
  } else {
    // In Production, register ServiceWorker for offline PWA functionality
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('Service Worker registered successfully:', reg.scope))
        .catch((err) => console.error('Service Worker registration failed:', err));
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

