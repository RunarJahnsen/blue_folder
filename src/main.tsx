import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import './index.css';
import App from './App.tsx';

window.onerror = (message, source, lineno, colno, error) => {
  console.error('[GlobalError]', { message, source, lineno, colno, error });
};

window.onunhandledrejection = (event) => {
  console.error('[UnhandledRejection]', event.reason);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
