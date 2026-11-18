import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

// Bez StrictMode: start aplikacji wymienia kod OAuth, a efekt uruchomiony dwa razy by go zgubił.
createRoot(document.getElementById('root')!).render(<App />);
