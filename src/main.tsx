import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import './index.css';
import App from './App.tsx';

try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>,
  );
} catch (err) {
  console.error('[RENDER_CRASH]', err);
  document.getElementById('root')!.innerHTML =
    '<pre style="color:red;padding:1rem">[RENDER_CRASH] ' + String(err) + '</pre>';
}
