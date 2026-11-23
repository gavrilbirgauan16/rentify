// Antetul: logo (duce la prima pagina), meniul si butoanele de cont. Responsive prin "container queries"
// (vezi tema.css): cand nu mai e loc, meniul se strange in butonul "Meniu".
// Se ascunde cand derulezi in jos si revine cand derulezi in sus (useAntetInteligent).
import { useState } from 'react';
import { Link, NavLink } from 'react-router';
import Logo from './Logo.jsx';
import { useSesiune } from '../sesiune/sesiune.js';
import { useAntetInteligent } from '../hooks/useAntetInteligent.js';

// Paginile din meniu (se adauga pe masura ce le construim). "end": activ doar pe adresa exacta.
const PAGINI = [
  { adresa: '/', text: 'Caută locuințe', end: true },
];

export default function Antet() {
  const { utilizator } = useSesiune();
  const [deschis, setDeschis] = useState(false);
  const inchide = () => setDeschis(false); // dupa un clic in meniu, lista se inchide
  const { ascuns, derulat } = useAntetInteligent();
  // Cu meniul deschis, antetul nu se ascunde (altfel ar fugi lista de sub deget).
  const clase = `antet continut${ascuns && !deschis ? ' ascuns' : ''}${derulat ? ' derulat' : ''}`;

  const butoaneCont = (clasaLata) => (utilizator ? (
    <span className="salut">Bună, <strong>{utilizator.prenume}</strong></span>
  ) : (
    <>
      <Link className={`buton buton-moale${clasaLata}`} to="/intrare" onClick={inchide}>Intră în cont</Link>
      <Link className={`buton buton-principal${clasaLata}`} to="/inregistrare" onClick={inchide}>Creează cont</Link>
    </>
  ));

  return (
    <header className={clase}>
      <div className="bara">
        <Link className="logo-link" to="/" aria-label="Rentify - prima pagină" onClick={inchide}><Logo /></Link>

        <nav id="meniu-principal" className={`meniu${deschis ? ' deschis' : ''}`} aria-label="Meniu principal">
          {PAGINI.map((p) => (
            // NavLink pune singur aria-current="page" pe pagina curenta (linia aurie din CSS)
            <NavLink key={p.adresa} to={p.adresa} end={p.end} onClick={inchide}>{p.text}</NavLink>
          ))}
          {/* pe ecran foarte ingust, butoanele de cont apar aici, in meniu */}
          <div className="doar-ingust">{butoaneCont(' buton-lat')}</div>
        </nav>

        <div className="actiuni">{butoaneCont('')}</div>

        <button className="buton buton-moale buton-meniu" type="button" aria-expanded={deschis} aria-controls="meniu-principal"
          onClick={() => setDeschis((d) => !d)}>
          {deschis ? '✕ Închide' : '☰ Meniu'}
        </button>
      </div>
    </header>
  );
}
