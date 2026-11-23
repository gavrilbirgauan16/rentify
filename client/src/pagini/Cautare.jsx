// Cautarea (/cautare?oras=Suceava&camere_min=2&sort=pret_asc&pagina=2): filtrele, sortarea si pagina stau
// toate in ADRESA. Datele vin din GET /api/anunturi (doar anunturile publice), cu totalul in antete
// (X-Total-Count, X-Pagina, X-Total-Pagini). Pe ecran lat filtrele sunt in stanga; pe ecran ingust, intr-o fereastra.
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useApi } from '../api/useApi.js';
import CardAnunt from '../componente/CardAnunt.jsx';
import Fereastra from '../componente/Fereastra.jsx';
import Paginare from '../componente/Paginare.jsx';
import PanouFiltre from '../componente/PanouFiltre.jsx';
import { FILTRE_CAUTARE } from '../utile/formatare.js';

const PE_PAGINA = 12;
const SORTARI = { noi: 'Cele mai noi', pret_asc: 'Preț crescător', pret_desc: 'Preț descrescător' };

export default function Cautare() {
  const [parametri, setParametri] = useSearchParams();
  const [filtreDeschise, setFiltreDeschise] = useState(false); // fereastra cu filtre (ecran ingust)

  // Cererea catre API: filtrele + sortarea + pagina din adresa.
  const cerere = new URLSearchParams();
  for (const f of [...FILTRE_CAUTARE, 'sort', 'pagina']) if (parametri.get(f)) cerere.set(f, parametri.get(f));
  cerere.set('pe_pagina', String(PE_PAGINA));
  const { date: anunturi, antete, eroare, incarcare, reincarca } = useApi(`/anunturi?${cerere}`);

  const total = Number(antete?.get('X-Total-Count') ?? 0);
  const pagina = Number(antete?.get('X-Pagina') ?? 1);
  const totalPagini = Number(antete?.get('X-Total-Pagini') ?? 1);
  const filtreActive = FILTRE_CAUTARE.filter((f) => parametri.get(f)).length;
  const sort = parametri.get('sort') ?? 'noi';

  // Filtre noi -> de la pagina 1 (pastram sortarea aleasa).
  function aplica(noi) {
    if (parametri.get('sort')) noi.set('sort', parametri.get('sort'));
    setParametri(noi);
    setFiltreDeschise(false);
  }
  const sterge = () => aplica(new URLSearchParams());
  function schimbaSortarea(e) {
    const noi = new URLSearchParams(parametri);
    if (e.target.value === 'noi') noi.delete('sort'); else noi.set('sort', e.target.value);
    noi.delete('pagina');
    setParametri(noi);
  }
  const adresaPentru = (nr) => {
    const noi = new URLSearchParams(parametri);
    if (nr === 1) noi.delete('pagina'); else noi.set('pagina', String(nr));
    return `/cautare?${noi}`;
  };

  // key: cand adresa se schimba, panoul se reface cu valorile noi
  const panou = <PanouFiltre key={parametri.toString()} parametri={parametri} laAplicare={aplica} laStergere={sterge} />;

  return (
    <div className="pagina-cautare">
      <aside className="coloana-filtre" aria-label="Filtre">
        <h2>Filtre</h2>
        {panou}
      </aside>

      <section className="coloana-rezultate" aria-busy={incarcare}>
        <div className="cap-rezultate">
          <div>
            <h1>{parametri.get('oras') ? `Locuințe în ${parametri.get('oras')}` : 'Caută locuințe'}</h1>
            {anunturi && !eroare && <p className="numar-rezultate">{total === 1 ? '1 locuință găsită' : `${total} locuințe găsite`}</p>}
          </div>
          <div className="unelte-rezultate">
            <button className="buton buton-moale buton-filtre" type="button" onClick={() => setFiltreDeschise(true)}>
              Filtre{filtreActive > 0 ? ` (${filtreActive})` : ''}
            </button>
            <label className="sortare">
              <span>Ordonează</span>
              <select className="intrare" value={sort} onChange={schimbaSortarea}>
                {Object.entries(SORTARI).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
            </label>
          </div>
        </div>

        {eroare ? (
          <div className="alerta alerta-eroare" role="alert">{eroare.message} <button className="buton buton-moale" type="button" onClick={reincarca}>Reîncearcă</button></div>
        ) : !anunturi ? (
          <div className="grila-anunturi">{Array.from({ length: 6 }, (_, i) => <div key={i} className="card-schelet" />)}</div>
        ) : anunturi.length === 0 ? (
          <div className="gol">
            <p><strong>Nicio locuință nu se potrivește filtrelor.</strong></p>
            <p>Încearcă un preț mai mare sau mai puține filtre.</p>
            {filtreActive > 0 && <button className="buton buton-moale" type="button" onClick={sterge}>Șterge filtrele</button>}
          </div>
        ) : (
          <>
            <div className={`grila-anunturi${incarcare ? ' se-actualizeaza' : ''}`}>
              {anunturi.map((a) => <CardAnunt key={a.id} anunt={a} />)}
            </div>
            <Paginare pagina={pagina} totalPagini={totalPagini} adresaPentru={adresaPentru} />
          </>
        )}
      </section>

      {/* pe ecran ingust: aceleasi filtre, intr-o fereastra */}
      <Fereastra deschisa={filtreDeschise} titlu="Filtre" laInchidere={() => setFiltreDeschise(false)}>
        {filtreDeschise && panou}
      </Fereastra>
    </div>
  );
}
