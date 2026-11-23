// Formularul unui anunt, pentru adaugare (/proprietar/anunturi/nou) si modificare (/proprietar/anunturi/12).
//  - anunt NOU:   POST /api/proprietar/anunturi (ca ciorna sau trimis spre aprobare), apoi pozele alese
//  - modificare:  PUT  /api/proprietar/anunturi/:id; pozele se trimit / sterg pe loc (adrese separate)
// Serverul verifica tot (proprietatea e a ta, limita din plan, moderarea); aici doar aratam ce raspunde.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../../api/client.js';
import { useApi } from '../../api/useApi.js';
import { Camp } from '../../componente/Camp.jsx';
import ZonaPoze from '../../componente/ZonaPoze.jsx';
import { STARI_ANUNT } from '../../utile/formatare.js';

const LISTA = '/proprietar/anunturi';

// La MODIFICARE trimitem intentia, nu starea curenta: serverul accepta doar starile care se aleg dintr-un formular
// (ciorna / activ / inactiv); "in asteptare" si "respins" apar doar prin actiuni (trimitere, respingere de admin).
//  - publicat sau trimis spre aprobare -> "activ" (daca s-a schimbat continutul, serverul il trimite din nou la aprobare)
//  - "Salveaza si trimite spre aprobare" -> "activ"
//  - respins, salvat simplu -> "ciorna" (il corectezi si il retrimiti cand esti gata)
//  - ciorna / inactiv, salvat simplu -> raman cum erau
function stareDeTrimis(stareActuala, publica) {
  if (publica || stareActuala === 'activ' || stareActuala === 'in_asteptare') return 'activ';
  if (stareActuala === 'respins') return 'ciorna';
  return stareActuala;
}

// Anuntul primit de la API -> campurile formularului (in formular totul e text; golul inseamna "nu e completat").
function campuriDin(a, proprietati) {
  const text = (v) => (v === null || v === undefined ? '' : String(v));
  if (!a) {
    // anunt nou: daca are o singura proprietate activa, o alegem direct
    return { proprietate_id: proprietati.length === 1 ? String(proprietati[0].id) : '', tip: 'inchiriere', titlu: '', descriere: '', pret: '', moneda: 'RON', pret_o_persoana: '', garantie: '', disponibil_de_la: '', locuri_libere: '' };
  }
  return {
    proprietate_id: text(a.proprietate.id), tip: a.tip, titlu: a.titlu, descriere: text(a.descriere), pret: text(a.pret), moneda: a.moneda,
    pret_o_persoana: text(a.pret_o_persoana), garantie: text(a.garantie), disponibil_de_la: text(a.disponibil_de_la), locuri_libere: text(a.locuri_libere),
  };
}

function Formular({ anunt, proprietati }) {
  const navigate = useNavigate();
  const nou = !anunt;
  const [c, setC] = useState(() => campuriDin(anunt, proprietati));
  const [erori, setErori] = useState({});
  const [eroare, setEroare] = useState(null);
  const [seSalveaza, setSeSalveaza] = useState(false);
  // pozele: la modificare, cele de pe server (se schimba pe loc); la anunt nou, cele alese (se trimit la salvare)
  const [imagini, setImagini] = useState(anunt?.imagini ?? []);
  const [locale, setLocale] = useState([]);
  const [stare, setStare] = useState(anunt?.stare ?? 'ciorna');
  const [seTrimitPoze, setSeTrimitPoze] = useState(false);
  const [eroarePoze, setEroarePoze] = useState(null);
  const [notaPoze, setNotaPoze] = useState(null);

  const schimba = (camp) => (e) => {
    setC((v) => ({ ...v, [camp]: e.target.value }));
    setErori((er) => ({ ...er, [camp]: undefined }));
  };

  // Raspunsul serverului dupa o schimbare de poze: pozele noi si, poate, starea (un anunt aprobat
  // cu poze schimbate trebuie aprobat din nou -> "In asteptare").
  function dupaPoze({ date: r }) {
    setImagini(r.imagini);
    if (stare === 'activ' && r.stare === 'in_asteptare') setNotaPoze('Pozele s-au schimbat, așa că anunțul a fost trimis din nou spre aprobare.');
    setStare(r.stare);
  }

  async function adaugaPoze(fisiere) {
    if (nou) { // anunt nou: le pastram si le trimitem dupa salvare
      setLocale((l) => [...l, ...fisiere]);
      return;
    }
    setSeTrimitPoze(true);
    setEroarePoze(null);
    try {
      const fd = new FormData();
      fisiere.forEach((f) => fd.append('imagini', f));
      dupaPoze(await api.post(`/proprietar/anunturi/${anunt.id}/imagini`, fd));
    } catch (e) {
      setEroarePoze(e.erori?.imagini || e.message);
    } finally {
      setSeTrimitPoze(false);
    }
  }

  async function stergePoza(poza) {
    setSeTrimitPoze(true);
    setEroarePoze(null);
    try {
      dupaPoze(await api.delete(`/proprietar/anunturi/${anunt.id}/imagini/${poza.id}`));
    } catch (e) {
      setEroarePoze(e.message);
    } finally {
      setSeTrimitPoze(false);
    }
  }

  async function salveaza(e) {
    e.preventDefault();
    // Care buton a trimis formularul? (HTML5: event.submitter) - "publica" sau "ciorna"
    const publica = e.nativeEvent.submitter?.value === 'publica';
    setEroare(null);
    setSeSalveaza(true);
    try {
      if (nou) {
        const { date: creat } = await api.post('/proprietar/anunturi', { ...c, stare: publica ? 'activ' : 'ciorna' });
        let mesaj = creat.stare === 'in_asteptare' ? `„${creat.titlu}” a fost salvat și trimis spre aprobare.` : `„${creat.titlu}” a fost salvat ca ciornă.`;
        if (locale.length > 0) {
          try {
            const fd = new FormData();
            locale.forEach((f) => fd.append('imagini', f));
            await api.post(`/proprietar/anunturi/${creat.id}/imagini`, fd);
          } catch (err) {
            // anuntul exista deja: mergem la el, ca sa poata incerca din nou doar pozele
            navigate(`${LISTA}/${creat.id}`, { replace: true, state: { mesaj: `${mesaj} Pozele nu s-au putut încărca: ${err.erori?.imagini || err.message}` } });
            return;
          }
        }
        navigate(LISTA, { state: { mesaj } });
      } else {
        const { date: r } = await api.put(`/proprietar/anunturi/${anunt.id}`, { ...c, stare: stareDeTrimis(stare, publica) });
        const mesaj = stare === 'activ' && r.stare === 'in_asteptare'
          ? `Modificările la „${r.titlu}” au fost salvate. Conținutul s-a schimbat, așa că anunțul a fost trimis din nou spre aprobare.`
          : r.stare === 'in_asteptare' && stare !== 'in_asteptare'
            ? `„${r.titlu}” a fost salvat și trimis spre aprobare.`
            : `Modificările la „${r.titlu}” au fost salvate.`;
        navigate(LISTA, { state: { mesaj } });
      }
    } catch (err) {
      setErori(err.erori);
      // limita din plan vine ca eroare la "stare" (nu e un camp in formular): o aratam sus
      if (err.erori.stare || Object.keys(err.erori).length === 0) setEroare(err.erori.stare || err.message);
      setSeSalveaza(false);
    }
  }

  const inchiriere = c.tip === 'inchiriere';
  const eticheta = STARI_ANUNT[stare];

  return (
    <form className="formular-anunt" onSubmit={salveaza}>
      <div className="formular-cap">
        <div>
          <Link className="inapoi" to={LISTA}>← Anunțurile mele</Link>
          <h2>{nou ? 'Anunț nou' : 'Modifică anunțul'}</h2>
        </div>
        {!nou && eticheta && <span className={`insigna ${eticheta.clasa}`}>{eticheta.text}</span>}
      </div>

      {!nou && anunt.aprobat && stare === 'activ' && (
        <p className="nota-stare">Anunțul e aprobat și apare pe site. Dacă schimbi textul, prețul sau pozele, va trebui aprobat din nou.</p>
      )}
      {stare === 'respins' && anunt?.motiv_respingere && (
        <p className="nota-stare respins"><strong>Motivul respingerii:</strong> {anunt.motiv_respingere}</p>
      )}

      <div className="formular-grila">
        <fieldset className="card-sectiune">
          <legend>Despre anunț</legend>
          <Camp element="select" eticheta="Proprietatea" required value={c.proprietate_id} onChange={schimba('proprietate_id')} eroare={erori.proprietate_id}>
            <option value="">Alege proprietatea…</option>
            {proprietati.map((p) => <option key={p.id} value={p.id}>{p.denumire} · {p.oras}{p.stare === 'inactiv' ? ' (inactivă)' : ''}</option>)}
          </Camp>
          <div className="rand-doi">
            <Camp element="select" eticheta="Tip" value={c.tip} onChange={schimba('tip')} eroare={erori.tip}>
              <option value="inchiriere">Închiriere</option>
              <option value="vanzare">Vânzare</option>
            </Camp>
            <Camp eticheta="Disponibil de la" type="date" value={c.disponibil_de_la} onChange={schimba('disponibil_de_la')} eroare={erori.disponibil_de_la} />
          </div>
          <Camp eticheta="Titlu" required maxLength={120} value={c.titlu} onChange={schimba('titlu')} eroare={erori.titlu}
            placeholder="ex. Apartament luminos cu 2 camere, lângă centru" ajutor={`${c.titlu.length} / 120 caractere`} />
          <Camp element="textarea" eticheta="Descriere" rows={6} value={c.descriere} onChange={schimba('descriere')} eroare={erori.descriere}
            placeholder="Ce face locuința specială: lumina, vecinătatea, ce e inclus în chirie…" />
        </fieldset>

        <fieldset className="card-sectiune">
          <legend>Preț</legend>
          <div className="rand-pret">
            <Camp eticheta={inchiriere ? 'Chiria pe lună (toată locuința)' : 'Preț'} type="number" min="1" step="any" inputMode="decimal" required
              value={c.pret} onChange={schimba('pret')} eroare={erori.pret} />
            <Camp element="select" eticheta="Monedă" value={c.moneda} onChange={schimba('moneda')} eroare={erori.moneda}>
              <option value="RON">lei</option>
              <option value="EUR">EUR</option>
            </Camp>
          </div>
          {inchiriere && (
            <Camp eticheta="Preț pentru o singură persoană (opțional)" type="number" min="1" step="any" inputMode="decimal"
              value={c.pret_o_persoana} onChange={schimba('pret_o_persoana')} eroare={erori.pret_o_persoana}
              ajutor="O reducere când locuiește o singură persoană. De la 2 persoane, chiria se împarte egal." />
          )}
          <div className="rand-doi">
            <Camp eticheta="Garanție (opțional)" type="number" min="0" step="any" inputMode="decimal" value={c.garantie} onChange={schimba('garantie')} eroare={erori.garantie} />
            {inchiriere && <Camp eticheta="Locuri libere (opțional)" type="number" min="0" step="1" inputMode="numeric" value={c.locuri_libere} onChange={schimba('locuri_libere')} eroare={erori.locuri_libere} />}
          </div>
        </fieldset>

        <fieldset className="card-sectiune pe-tot-randul">
          <legend>Poze</legend>
          {notaPoze && <p className="nota-stare">{notaPoze}</p>}
          <ZonaPoze existente={imagini} locale={locale} ocupat={seTrimitPoze} eroare={eroarePoze}
            laAlegere={adaugaPoze} laStergereExistenta={stergePoza} laStergereLocala={(i) => setLocale((l) => l.filter((_, j) => j !== i))} />
          {nou && locale.length > 0 && <p className="nota">Pozele se trimit când salvezi anunțul.</p>}
        </fieldset>
      </div>

      {eroare && <div className="alerta alerta-eroare" role="alert">{eroare}</div>}

      <div className="formular-butoane">
        <Link className="buton buton-moale" to={LISTA}>Renunță</Link>
        {nou ? (
          <>
            <button className="buton buton-moale" type="submit" name="actiune" value="ciorna" disabled={seSalveaza}>Salvează ca ciornă</button>
            <button className="buton buton-principal" type="submit" name="actiune" value="publica" disabled={seSalveaza}>
              {seSalveaza ? 'Se salvează…' : 'Salvează și trimite spre aprobare'}
            </button>
          </>
        ) : stare === 'activ' || stare === 'in_asteptare' ? (
          // deja publicat (sau trimis): o singura salvare; serverul decide daca trebuie aprobat din nou
          <button className="buton buton-principal" type="submit" value="pastreaza" disabled={seSalveaza}>{seSalveaza ? 'Se salvează…' : 'Salvează modificările'}</button>
        ) : (
          <>
            <button className="buton buton-moale" type="submit" value="pastreaza" disabled={seSalveaza}>{stare === 'respins' ? 'Salvează ca ciornă' : 'Salvează'}</button>
            <button className="buton buton-principal" type="submit" value="publica" disabled={seSalveaza}>
              {seSalveaza ? 'Se salvează…' : stare === 'respins' ? 'Salvează și retrimite spre aprobare' : 'Salvează și trimite spre aprobare'}
            </button>
          </>
        )}
      </div>
    </form>
  );
}

export default function FormularAnunt() {
  const { id } = useParams(); // lipseste la "nou"
  const proprietati = useApi('/proprietar/proprietati');
  const anunt = useApi(id ? `/proprietar/anunturi/${id}` : null);

  const eroare = proprietati.eroare || anunt.eroare;
  if (eroare) {
    return (
      <div className="gol">
        <p><strong>{eroare.status === 404 ? 'Anunțul nu există printre anunțurile tale.' : eroare.message}</strong></p>
        <Link className="buton buton-moale" to={LISTA}>Înapoi la anunțurile mele</Link>
      </div>
    );
  }
  if (!proprietati.date || (id && !anunt.date)) return <div className="card-schelet formular" />;

  // In lista: proprietatile active; la modificare si proprietatea actuala, chiar daca intre timp e inactiva.
  const toate = proprietati.date.proprietati;
  const lista = toate.filter((p) => p.stare !== 'inactiv' || p.id === anunt.date?.proprietate.id);
  // key: alt anunt (sau "nou") -> formular nou, cu campurile lui (nu ramane ce era completat inainte)
  return <Formular key={id ?? 'nou'} anunt={anunt.date} proprietati={lista} />;
}
