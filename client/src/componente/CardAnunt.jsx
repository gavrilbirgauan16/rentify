// Cardul unui anunt din lista (poza, oras, titlu, camere, suprafata, pret). Primeste anuntul asa cum il trimite API-ul.
const pretAfisat = (a) => `${Number(a.pret).toLocaleString('ro-RO')} ${a.moneda === 'RON' ? 'lei' : a.moneda}`;

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
        <h3>{a.titlu}</h3>
        <div className="detalii">
          {p.nr_camere > 0 && <span>{p.nr_camere} {p.nr_camere === 1 ? 'cameră' : 'camere'}</span>}
          {p.suprafata_mp > 0 && <span>{p.suprafata_mp} m²</span>}
          {a.promovat && <span className="insigna insigna-promovat">★ Promovat</span>}
        </div>
        <div className="pret">{pretAfisat(a)} {a.tip === 'inchiriere' && <small>/ lună</small>}</div>
      </div>
    </article>
  );
}
