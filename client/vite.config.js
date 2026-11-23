// Configurarea Vite: unealta care porneste interfata React in timpul lucrului (npm run dev, portul 5173)
// si o impacheteaza in fisiere statice pentru publicare (npm run build -> folderul dist/).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Adresa serverului Express. Implicit cel pornit cu "npm run dev"; se poate schimba (ex. pentru teste)
// cu variabila de mediu RENTIFY_API, fara sa modificam fisierul.
const SERVER = process.env.RENTIFY_API || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // daca portul e ocupat, oprim (nu sarim pe alt port, ca adresa sa fie mereu aceeasi)
    // Proxy: cererile catre /api si /uploads (pozele) merg la serverul Express (implicit portul 3000).
    // Pentru browser totul vine de la aceeasi adresa (localhost:5173), deci cookie-ul de sesiune
    // si tokenul CSRF merg exact ca in paginile EJS - fara CORS si fara setari in plus pe server.
    proxy: {
      '/api': SERVER,
      '/uploads': SERVER,
    },
  },
});
