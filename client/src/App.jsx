// Aplicatia: sesiunea, ecranul de intrare si paginile (React Router).
// Adresele paginilor sunt scrise O SINGURA DATA, aici. Paginile se adauga pe masura ce le construim.
import { useEffect, useState } from 'react';
import { Navigate, createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import SesiuneProvider from './sesiune/SesiuneProvider.jsx';
import { useSesiune } from './sesiune/sesiune.js';
import EcranIntrare from './componente/EcranIntrare.jsx';
import Cadru from './componente/Cadru.jsx';
import Acasa from './pagini/Acasa.jsx';
import NuExista from './pagini/NuExista.jsx';
import PaginaCont from './pagini/PaginaCont.jsx';
import Cautare from './pagini/Cautare.jsx';
import PaginaAnunt from './pagini/PaginaAnunt.jsx';
import ParolaUitata from './pagini/cont/ParolaUitata.jsx';
import ResetareParola from './pagini/cont/ResetareParola.jsx';
import ConfirmareCont from './pagini/cont/ConfirmareCont.jsx';
import ConfirmareEmail from './pagini/cont/ConfirmareEmail.jsx';
import ContulMeu from './pagini/cont/ContulMeu.jsx';
import RutaProtejata from './componente/RutaProtejata.jsx';
import ZonaProprietar from './pagini/proprietar/ZonaProprietar.jsx';
import AnunturileMele from './pagini/proprietar/AnunturileMele.jsx';
import FormularAnunt from './pagini/proprietar/FormularAnunt.jsx';
import ProprietatileMele from './pagini/proprietar/ProprietatileMele.jsx';
import FormularProprietate from './pagini/proprietar/FormularProprietate.jsx';
import AbonamentulMeu from './pagini/proprietar/AbonamentulMeu.jsx';
import ConfirmarePlan from './pagini/proprietar/ConfirmarePlan.jsx';

const router = createBrowserRouter([
  {
    Component: Cadru, // antetul + subsolul, pentru toate paginile
    children: [
      {
        // O eroare intr-o pagina se arata IN cadru (antetul ramane), nu ca o pagina alba.
        ErrorBoundary: NuExista,
        children: [
          { index: true, Component: Acasa },
          { path: 'cautare', Component: Cautare },
          { path: 'anunturi/:id', Component: PaginaAnunt },
          {
            // Ambele adrese folosesc ACEEASI pagina (nu se reface la schimbare), deci cardul se poate intoarce animat.
            Component: PaginaCont,
            children: [{ path: 'intrare' }, { path: 'inregistrare' }],
          },
          // Paginile deschise din linkurile primite pe email (adresele sunt cele din servicii/emailuri.js)
          { path: 'parola-uitata', Component: ParolaUitata },
          { path: 'resetare/:token', Component: ResetareParola },
          { path: 'confirmare/:token', Component: ConfirmareCont },
          { path: 'cont/email/confirmare/:token', Component: ConfirmareEmail }, // merge si fara sa fii conectat
          {
            // "Contul meu": orice cont conectat (chirias, proprietar, admin)
            element: <RutaProtejata />,
            children: [{ path: 'cont', Component: ContulMeu }],
          },
          {
            // Zona proprietarului: doar pentru conturile de proprietar (altfel -> "Intra in cont").
            element: <RutaProtejata rol="proprietar" />,
            children: [{
              path: 'proprietar',
              Component: ZonaProprietar, // titlul si filele, comune
              children: [
                { index: true, element: <Navigate to="anunturi" replace /> },
                { path: 'anunturi', Component: AnunturileMele },
                { path: 'anunturi/nou', Component: FormularAnunt },
                { path: 'anunturi/:id', Component: FormularAnunt },
                { path: 'proprietati', Component: ProprietatileMele },
                { path: 'proprietati/nou', Component: FormularProprietate },
                { path: 'proprietati/:id', Component: FormularProprietate },
                { path: 'abonament', Component: AbonamentulMeu },
                { path: 'abonament/schimba', Component: ConfirmarePlan }, // ?plan=3&perioada=lunar
              ],
            }],
          },
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
