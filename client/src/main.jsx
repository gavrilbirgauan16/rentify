// Punctul de intrare al interfetei: React preia elementul <div id="root"> din index.html
// si deseneaza in el componenta App (si tot ce contine ea).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Fonturile (fisiere in proiect) si sistemul de design: se incarca o singura data, pentru toata aplicatia.
import '@fontsource-variable/inter';
import '@fontsource-variable/playfair-display';
import './stiluri/tema.css';
import App from './App.jsx';

// StrictMode: doar in timpul lucrului, React verifica de doua ori unele lucruri ca sa prinda greseli devreme
// (ex. efecte care nu se curata). In varianta publicata (npm run build) nu face nimic in plus.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
