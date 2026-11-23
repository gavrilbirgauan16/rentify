// Cadrul comun al paginilor: antetul, continutul paginii curente (<Outlet />) si subsolul.
// Paginile de cont sunt "fixe": ocupa exact ecranul, fara derulare si fara subsol (vezi .pagina-fixa in tema.css).
import { Outlet, ScrollRestoration, useLocation } from 'react-router';
import Antet from './Antet.jsx';
import Logo from './Logo.jsx';

const PAGINI_FIXE = ['/intrare', '/inregistrare'];

export default function Cadru() {
  const fixa = PAGINI_FIXE.includes(useLocation().pathname);
  return (
    <div className={`aplicatie${fixa ? ' pagina-fixa' : ''}`}>
      {/* sare direct la continut (tastatura / cititor de ecran), peste meniu */}
      <a className="sari-la-continut" href="#continut">Sari la conținut</a>
      <Antet />
      <main id="continut" className="continut">
        <Outlet />
      </main>
      {!fixa && (
        <footer className="subsol">
          <div className="continut">
            <Logo marime={28} />
            <p>Închirieri de locuințe, direct de la proprietari. Proiect PPAW, {new Date().getFullYear()}.</p>
          </div>
        </footer>
      )}
      {/* la schimbarea paginii, derulam sus (ca la un site obisnuit); "Inapoi" revine unde erai */}
      <ScrollRestoration />
    </div>
  );
}
