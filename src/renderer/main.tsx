import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

async function bootstrap(): Promise<void> {
  // Dev-only UI preview in a plain browser (never bundled into production).
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('mock')) {
    const { installDevMock } = await import('./devMock');
    installDevMock();
  }

  const container = document.getElementById('root');
  if (!container) throw new Error('missing #root');
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
