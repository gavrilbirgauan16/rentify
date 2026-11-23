// Cardul unui anunt din lista (poza, oras, titlu, camere, suprafata, pret). Primeste anuntul asa cum il trimite API-ul.
import { Link } from 'react-router';
import { pretAfisat } from '../utile/formatare.js';

// Tot cardul e clicabil, dar in HTML exista UN singur link (pe titlu): CSS-ul il intinde peste tot cardul
// (::after). Asa cititorul de ecran aude titlul o singura data, nu tot continutul cardului ca text de link.

export default function CardAnunt({ anunt: a }) {
  const p = a.proprietate || {};
  return (
    <article className="card-anunt">
      <div className="poza">
        {a.imagini?.[0]
          ? <img src={a.imagini[0]} alt={a.titlu} loading="lazy" />
          : <div className="fara-poza">fără poză</div>}
      </div>
      <div className="corp">
        <div className="oras">{p.oras}{p.zona ? ` · ${p.zona}` : ''}</div>
        <h3><Link className="link-card" to={`/anunturi/${a.id}`}>{a.titlu}</Link></h3>
        <div className="detalii">
          {p.nr_camere > 0 && <span>{p.nr_camere} {p.nr_camere === 1 ? 'cameră' : 'camere'}</span>}
          {p.suprafata_mp > 0 && <span>{p.suprafata_mp} m²</span>}
          {a.promovat && <span className="insigna insigna-promovat">★ Promovat</span>}
        </div>
        <div className="pret">{pretAfisat(a.pret, a.moneda)} {a.tip === 'inchiriere' && <small>/ lună</small>}</div>
      </div>
    </article>
  );
}
