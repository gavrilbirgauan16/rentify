// Aplicatia: sesiunea, ecranul de intrare si paginile (React Router).
// Adresele paginilor sunt scrise O SINGURA DATA, aici. Paginile se adauga pe masura ce le construim.
import { useEffect, useState } from 'react';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import SesiuneProvider from './sesiune/SesiuneProvider.jsx';
import { useSesiune } from './sesiune/sesiune.js';
import EcranIntrare from './componente/EcranIntrare.jsx';
import Cadru from './componente/Cadru.jsx';
import Acasa from './pagini/Acasa.jsx';
import NuExista from './pagini/NuExista.jsx';

const router = createBrowserRouter([
  {
    Component: Cadru, // antetul + subsolul, pentru toate paginile
    children: [
      {
        // O eroare intr-o pagina se arata IN cadru (antetul ramane), nu ca o pagina alba.
        ErrorBoundary: NuExista,
        children: [
          { index: true, Component: Acasa },
          { path: '*', Component: NuExista }, // orice alta adresa: 404
        ],
      },
    ],
  },
]);

// Ecranul cu logo: prima data in aceasta fila, macar putin (sa se vada animatia); apoi doar cat dureaza
// verificarea sesiunii (la un refresh nu mai asteptam degeaba).
const CHEIE_INTRARE = 'rentify-intrare-vazuta';
function primaIntrare() {
  try { return !sessionStorage.getItem(CHEIE_INTRARE); } catch { return true; }
}

function Pornire() {
  const { verificata } = useSesiune();
  const [asteaptaAnimatia, setAsteaptaAnimatia] = useState(primaIntrare);

  useEffect(() => {
    try { sessionStorage.setItem(CHEIE_INTRARE, '1'); } catch { /* fara sessionStorage: nu e grav */ }
    const t = setTimeout(() => setAsteaptaAnimatia(false), 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <EcranIntrare vizibil={!verificata || asteaptaAnimatia} />
      <RouterProvider router={router} />
    </>
  );
}

export default function App() {
  return (
    <SesiuneProvider>
      <Pornire />
    </SesiuneProvider>
  );
}
