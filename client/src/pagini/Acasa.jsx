// Prima pagina: cautarea si anunturile (din API: GET /api/anunturi). Filtrele stau in ADRESA paginii
// (?q=Suceava&camere_min=2), deci cautarea poate fi trimisa cuiva, iar butonul "Inapoi" al browserului merge.
import { Link, useSearchParams } from 'react-router';
import { useApi } from '../api/useApi.js';
import CardAnunt from '../componente/CardAnunt.jsx';

const FILTRE = ['q', 'camere_min', 'pret_max']; // doar acestea trec din adresa in cererea catre API

export default function Acasa() {
  const [parametri, setParametri] = useSearchParams();

  const cautare = new URLSearchParams();
  for (const f of FILTRE) if (parametri.get(f)) cautare.set(f, parametri.get(f));
  cautare.set('pe_pagina', '12');
  const { date: anunturi, antete, eroare, incarcare, reincarca } = useApi(`/anunturi?${cautare}`);
  const total = Number(antete?.get('X-Total-Count') ?? anunturi?.length ?? 0);
  const areFiltre = FILTRE.some((f) => parametri.get(f));

  // La "Cauta": citim campurile formularului si le punem in adresa (cele goale nu).
  function cauta(e) {
    e.preventDefault();
    const noi = new URLSearchParams();
    for (const [cheie, valoare] of new FormData(e.currentTarget)) if (String(valoare).trim()) noi.set(cheie, String(valoare).trim());
    setParametri(noi);
  }

  return (
    <>
      <section className="hero">
        <h1>Găsește-ți locul în care să te simți <em>acasă</em></h1>
        <p>Locuințe verificate, direct de la proprietari. Fără comisioane, fără surprize la plata chiriei.</p>
        <div className="zona-cautare">
          {/* key: cand adresa se schimba (ex. clic pe logo), formularul se reface cu valorile noi */}
          <form className="cautare" role="search" onSubmit={cauta} key={parametri.toString()}>
            <input className="intrare" name="q" defaultValue={parametri.get('q') ?? ''} placeholder="Oraș, zonă sau cuvânt (ex. Suceava, Centru)" aria-label="Oraș, zonă sau cuvânt" />
            <select className="intrare" name="camere_min" defaultValue={parametri.get('camere_min') ?? ''} aria-label="Număr de camere">
              <option value="">Orice număr de camere</option>
              <option value="1">Cel puțin 1 cameră</option>
              <option value="2">Cel puțin 2 camere</option>
              <option value="3">Cel puțin 3 camere</option>
            </select>
            <input className="intrare" name="pret_max" defaultValue={parametri.get('pret_max') ?? ''} placeholder="Preț maxim (lei)" inputMode="numeric" aria-label="Preț maxim în lei" />
            <button className="buton buton-principal" type="submit">Caută</button>
          </form>
        </div>
      </section>

      <section className="sectiune" aria-live="polite" aria-busy={incarcare}>
        <div className="titlu-sectiune">
          <h2>{areFiltre ? 'Rezultatele căutării' : 'Anunțuri noi'}</h2>
          {anunturi && !eroare && <span className="numar-rezultate">{total === 1 ? '1 locuință' : `${total} locuințe`}</span>}
        </div>

        {eroare ? (
          <div className="alerta alerta-eroare" role="alert">
            {eroare.message} <button className="buton buton-moale" type="button" onClick={reincarca}>Reîncearcă</button>
          </div>
        ) : !anunturi ? (
          // prima incarcare: "schelete" de carduri, cat vin datele
          <div className="grila-anunturi">{Array.from({ length: 6 }, (_, i) => <div key={i} className="card-schelet" />)}</div>
        ) : anunturi.length === 0 ? (
          <div className="gol">
            <p><strong>Nu am găsit nicio locuință</strong> pentru căutarea ta.</p>
            {areFiltre && <Link className="buton buton-moale" to="/">Șterge filtrele</Link>}
          </div>
        ) : (
          <div className={`grila-anunturi${incarcare ? ' se-actualizeaza' : ''}`}>
            {anunturi.map((a) => <CardAnunt key={a.id} anunt={a} />)}
          </div>
        )}
      </section>
    </>
  );
}
