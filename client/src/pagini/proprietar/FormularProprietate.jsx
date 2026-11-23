// Formularul unei proprietati: adaugare (/proprietar/proprietati/nou) si modificare (/proprietar/proprietati/5).
//  - noua:       POST /api/proprietar/proprietati  (limita din plan se verifica pe server -> 403 cu explicatia)
//  - modificare: PUT  /api/proprietar/proprietati/:id (o proprietate inactiva ramane inactiva; se activeaza din lista)
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../../api/client.js';
import { useApi } from '../../api/useApi.js';
import { Camp } from '../../componente/Camp.jsx';
import { JUDETE, STARI_PROPRIETATE, TIPURI_PROPRIETATE } from '../../utile/formatare.js';

const LISTA = '/proprietar/proprietati';

function campuriDin(p) {
  const text = (v) => (v === null || v === undefined ? '' : String(v));
  if (!p) return { denumire: '', tip: 'apartament', judet: '', oras: '', zona: '', nr_camere: '1', suprafata_mp: '', max_locatari: '1', are_balcon: false, stare: 'liber' };
  return {
    denumire: p.denumire, tip: p.tip, judet: p.judet, oras: p.oras, zona: text(p.zona), nr_camere: text(p.nr_camere),
    suprafata_mp: text(p.suprafata_mp), max_locatari: text(p.max_locatari), are_balcon: p.are_balcon, stare: p.stare,
  };
}

function Formular({ proprietate }) {
  const navigate = useNavigate();
  const noua = !proprietate;
  const inactiva = proprietate?.stare === 'inactiv';
  const [c, setC] = useState(() => campuriDin(proprietate));
  const [erori, setErori] = useState({});
  const [eroare, setEroare] = useState(null);
  const [seSalveaza, setSeSalveaza] = useState(false);

  const schimba = (camp) => (e) => {
    const valoare = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setC((v) => ({ ...v, [camp]: valoare }));
    setErori((er) => ({ ...er, [camp]: undefined }));
  };

  async function salveaza(e) {
    e.preventDefault();
    setEroare(null);
    setSeSalveaza(true);
    try {
      // in JSON: balconul true/false; numerele raman text (serverul le valideaza la fel ca la formularul EJS)
      const { date: p } = noua
        ? await api.post(LISTA, c)
        : await api.put(`${LISTA}/${proprietate.id}`, c);
      navigate(LISTA, { state: { mesaj: noua ? `„${p.denumire}” a fost adăugată. Acum îi poți face un anunț.` : `Modificările la „${p.denumire}” au fost salvate.` } });
    } catch (err) {
      setErori(err.erori);
      if (Object.keys(err.erori).length === 0 || err.erori.stare) setEroare(err.erori.stare || err.message); // ex. limita planului (403)
      setSeSalveaza(false);
    }
  }

  return (
    <form className="formular-anunt" onSubmit={salveaza}>
      <div className="formular-cap">
        <div>
          <Link className="inapoi" to={LISTA}>← Proprietățile mele</Link>
          <h2>{noua ? 'Proprietate nouă' : 'Modifică proprietatea'}</h2>
        </div>
        {!noua && <span className={`insigna ${STARI_PROPRIETATE[proprietate.stare].clasa}`}>{STARI_PROPRIETATE[proprietate.stare].text}</span>}
      </div>
      {inactiva && <p className="nota-stare">Proprietatea e inactivă: poți să-i modifici datele, dar rămâne inactivă până o activezi din listă.</p>}

      <div className="formular-grila">
        <fieldset className="card-sectiune">
          <legend>Locuința</legend>
          <Camp eticheta="Denumire" required maxLength={100} value={c.denumire} onChange={schimba('denumire')} eroare={erori.denumire}
            placeholder="ex. Apartament 2 camere, bloc nou" ajutor="O vezi doar tu (și administratorul); ajută să-ți recunoști locuințele." />
          <div className="rand-doi">
            <Camp element="select" eticheta="Tip" value={c.tip} onChange={schimba('tip')} eroare={erori.tip}>
              {Object.entries(TIPURI_PROPRIETATE).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </Camp>
            {!inactiva && (
              <Camp element="select" eticheta="Stare" value={c.stare} onChange={schimba('stare')} eroare={erori.stare}>
                <option value="liber">Liberă (se poate închiria)</option>
                <option value="ocupat">Ocupată</option>
              </Camp>
            )}
          </div>
          <div className="rand-trei">
            <Camp eticheta="Camere" type="number" min="1" step="1" inputMode="numeric" required value={c.nr_camere} onChange={schimba('nr_camere')} eroare={erori.nr_camere} />
            <Camp eticheta="Suprafață (m²)" type="number" min="1" step="any" inputMode="decimal" value={c.suprafata_mp} onChange={schimba('suprafata_mp')} eroare={erori.suprafata_mp} />
            <Camp eticheta="Locatari (maxim)" type="number" min="1" step="1" inputMode="numeric" required value={c.max_locatari} onChange={schimba('max_locatari')} eroare={erori.max_locatari} />
          </div>
          <label className="bifa">
            <input type="checkbox" checked={c.are_balcon} onChange={schimba('are_balcon')} />
            <span>Are balcon</span>
          </label>
        </fieldset>

        <fieldset className="card-sectiune">
          <legend>Unde se află</legend>
          {/* <datalist> (HTML5): sugestii cu toate judetele cand scrii; poti scrie si altceva */}
          <Camp eticheta="Județ" required list="lista-judete" autoComplete="off" value={c.judet} onChange={schimba('judet')} eroare={erori.judet} placeholder="Începe să scrii…" />
          <datalist id="lista-judete">{JUDETE.map((j) => <option key={j} value={j} />)}</datalist>
          <Camp eticheta="Oraș" required value={c.oras} onChange={schimba('oras')} eroare={erori.oras} placeholder="ex. Suceava" />
          <Camp eticheta="Zonă / cartier (opțional)" value={c.zona} onChange={schimba('zona')} eroare={erori.zona} placeholder="ex. Centru, Obcini" />
        </fieldset>
      </div>

      {eroare && <div className="alerta alerta-eroare" role="alert">{eroare}</div>}

      <div className="formular-butoane">
        <Link className="buton buton-moale" to={LISTA}>Renunță</Link>
        <button className="buton buton-principal" type="submit" disabled={seSalveaza}>
          {seSalveaza ? 'Se salvează…' : noua ? 'Adaugă proprietatea' : 'Salvează modificările'}
        </button>
      </div>
    </form>
  );
}

export default function FormularProprietate() {
  const { id } = useParams(); // lipseste la "noua"
  const { date, eroare } = useApi(id ? `${LISTA}/${id}` : null);
  if (eroare) {
    return (
      <div className="gol">
        <p><strong>{eroare.status === 404 ? 'Proprietatea nu există printre proprietățile tale.' : eroare.message}</strong></p>
        <Link className="buton buton-moale" to={LISTA}>Înapoi la proprietățile mele</Link>
      </div>
    );
  }
  if (id && !date) return <div className="card-schelet formular" />;
  return <Formular key={id ?? 'noua'} proprietate={date} />;
}
