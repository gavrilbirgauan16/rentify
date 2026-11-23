// Cadrul comun al paginilor: antetul, continutul paginii curente (<Outlet />) si subsolul.
import { Outlet, ScrollRestoration } from 'react-router';
import Antet from './Antet.jsx';
import Logo from './Logo.jsx';

export default function Cadru() {
  return (
    <div className="aplicatie">
      {/* sare direct la continut (tastatura / cititor de ecran), peste meniu */}
      <a className="sari-la-continut" href="#continut">Sari la conținut</a>
      <Antet />
      <main id="continut" className="continut">
        <Outlet />
      </main>
      <footer className="subsol">
        <div className="continut">
          <Logo marime={28} />
          <p>Închirieri de locuințe, direct de la proprietari. Proiect PPAW, {new Date().getFullYear()}.</p>
        </div>
      </footer>
      {/* la schimbarea paginii, derulam sus (ca la un site obisnuit); "Inapoi" revine unde erai */}
      <ScrollRestoration />
    </div>
  );
}
