// Prima pagina ("vitrina"): titlul, o cautare rapida si cele mai noi anunturi (GET /api/anunturi).
// "Cauta" duce la pagina de cautare (/cautare), care are toate filtrele, sortarea si paginile.
import { Link, useNavigate } from 'react-router';
import { useApi } from '../api/useApi.js';
import CardAnunt from '../componente/CardAnunt.jsx';

export default function Acasa() {
  const navigate = useNavigate();
  const { date: anunturi, antete, eroare, reincarca } = useApi('/anunturi?pe_pagina=6');
  const total = Number(antete?.get('X-Total-Count') ?? 0);

  // La "Cauta": campurile completate merg in adresa paginii de cautare (cele goale nu).
  function cauta(e) {
    e.preventDefault();
    const filtre = new URLSearchParams();
    for (const [cheie, valoare] of new FormData(e.currentTarget)) if (String(valoare).trim()) filtre.set(cheie, String(valoare).trim());
    navigate(`/cautare${filtre.size ? `?${filtre}` : ''}`);
  }

  return (
    <>
      <section className="hero">
        <h1>Găsește-ți locul în care să te simți <em>acasă</em></h1>
        <p>Locuințe verificate, direct de la proprietari. Fără comisioane, fără surprize la plata chiriei.</p>
        <div className="zona-cautare">
          <form className="cautare" role="search" onSubmit={cauta}>
            <input className="intrare" name="q" placeholder="Oraș, zonă sau cuvânt (ex. Suceava, Centru)" aria-label="Oraș, zonă sau cuvânt" />
            <select className="intrare" name="camere_min" defaultValue="" aria-label="Număr de camere">
              <option value="">Orice număr de camere</option>
              <option value="1">Cel puțin 1 cameră</option>
              <option value="2">Cel puțin 2 camere</option>
              <option value="3">Cel puțin 3 camere</option>
            </select>
            <input className="intrare" name="pret_max" type="number" min="0" inputMode="numeric" placeholder="Preț maxim (lei)" aria-label="Preț maxim în lei" />
            <button className="buton buton-principal" type="submit">Caută</button>
          </form>
        </div>
      </section>

      <section className="sectiune">
        <div className="titlu-sectiune">
          <h2>Anunțuri noi</h2>
          {total > 0 && <Link className="vezi-toate" to="/cautare">Vezi toate cele {total} →</Link>}
        </div>
        {eroare ? (
          <div className="alerta alerta-eroare" role="alert">
            {eroare.message} <button className="buton buton-moale" type="button" onClick={reincarca}>Reîncearcă</button>
          </div>
        ) : !anunturi ? (
          <div className="grila-anunturi">{Array.from({ length: 6 }, (_, i) => <div key={i} className="card-schelet" />)}</div>
        ) : anunturi.length === 0 ? (
          <div className="gol"><p><strong>Încă nu sunt anunțuri publicate.</strong> Revino curând!</p></div>
        ) : (
          <div className="grila-anunturi">{anunturi.map((a) => <CardAnunt key={a.id} anunt={a} />)}</div>
        )}
      </section>
    </>
  );
}
