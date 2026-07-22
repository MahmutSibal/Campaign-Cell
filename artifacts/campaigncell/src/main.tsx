import { createRoot } from 'react-dom/client';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import App from './App';
import './index.css';

// Configure the API client to attach JWT tokens on every request
setAuthTokenGetter(() => localStorage.getItem('campaigncell_token'));

createRoot(document.getElementById('root')!).render(<App />);
