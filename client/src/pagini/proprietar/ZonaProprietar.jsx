// Zona proprietarului: titlul si filele (Anunturile mele, ...). Pagina filei curente apare in <Outlet />.
import { NavLink, Outlet } from 'react-router';
import { useSesiune } from '../../sesiune/sesiune.js';

const FILE = [
  { adresa: '/proprietar/anunturi', text: 'Anunțurile mele' },
  { adresa: '/proprietar/proprietati', text: 'Proprietățile mele' },
];

export default function ZonaProprietar() {
  const { utilizator } = useSesiune();
  return (
    <div className="zona">
      <header className="zona-titlu">
        <p className="supratitlu">Zona proprietarului</p>
        <h1>Bună, {utilizator.prenume}</h1>
      </header>
      <nav className="file" aria-label="Secțiunile zonei de proprietar">
        {FILE.map((f) => <NavLink key={f.adresa} to={f.adresa}>{f.text}</NavLink>)}
      </nav>
      <Outlet />
    </div>
  );
}
