import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { testSupabaseConnection, isSupabaseConfigured } from './lib/supabase';

// Perform a non-blocking startup check for Supabase connectivity
if (isSupabaseConfigured) {
  testSupabaseConnection().then((result) => {
    console.info('[Supabase Connection Test]', result);
  });
} else {
  console.info(
    '[Supabase Client] Initialized in standby mode. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env to connect.'
  );
}

createRoot(document.getElementById('root')!).render(<App />);
