// "Anunturile mele": lista anunturilor proprietarului (GET /api/proprietar/anunturi), cu limita din plan
// si actiunile potrivite starii fiecarui anunt: publica / retrage / retrimite, editeaza, sterge.
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { api } from '../../api/client.js';
import { useApi } from '../../api/useApi.js';
import Fereastra from '../../componente/Fereastra.jsx';
import { pretAfisat, STARI_ANUNT, TIPURI_ANUNT } from '../../utile/formatare.js';

// Ce buton de stare primeste fiecare anunt (in functie de stare).
function actiuneStare(stare) {
  if (stare === 'activ') return { cale: 'retrage', text: 'Retrage de pe site' };
  if (stare === 'in_asteptare') return { cale: 'retrage', text: 'Retrage cererea' };
  if (stare === 'respins') return { cale: 'publica', text: 'Retrimite spre aprobare' };
  return { cale: 'publica', text: 'Publică' }; // ciorna, inactiv
}

function RandAnunt({ a, ocupat, laActiune, laStergere }) {
  const stare = STARI_ANUNT[a.stare] ?? { text: a.stare, clasa: 'insigna-ciorna' };
  const actiune = actiuneStare(a.stare);
  return (
    <li className="rand-anunt">
      <div className="miniatura-anunt">
        {a.imagini[0] ? <img src={a.imagini[0].url} alt="" loading="lazy" /> : <span>fără poză</span>}
      </div>
      <div className="detalii-anunt">
        <div className="linie-titlu">
          <h3><Link to={`/proprietar/anunturi/${a.id}`}>{a.titlu}</Link></h3>
          <span className={`insigna ${stare.clasa}`}>{stare.text}</span>
        </div>
        <p className="meta">
          {TIPURI_ANUNT[a.tip]} · <strong>{pretAfisat(a.pret, a.moneda)}</strong> · {a.proprietate.denumire}, {a.proprietate.oras}
          {' · '}{a.imagini.length === 1 ? '1 poză' : `${a.imagini.length} poze`}
        </p>
        {a.stare === 'in_asteptare' && <p className="nota-stare">Administratorul îl verifică; apare pe site după aprobare.</p>}
        {a.stare === 'respins' && <p className="nota-stare respins"><strong>Motivul respingerii:</strong> {a.motiv_respingere} Corectează anunțul și retrimite-l.</p>}
      </div>
      <div className="actiuni-anunt">
        <Link className="buton buton-moale" to={`/proprietar/anunturi/${a.id}`}>Editează</Link>
        <button className="buton buton-moale" type="button" disabled={ocupat} onClick={() => laActiune(a, actiune.cale)}>{actiune.text}</button>
        <button className="buton buton-pericol" type="button" disabled={ocupat} onClick={() => laStergere(a)}>Șterge</button>
      </div>
    </li>
  );
}

export default function AnunturileMele() {
  const { state } = useLocation(); // mesajul trimis de formular dupa salvare (ex. "Anuntul a fost salvat")
  const { date, eroare, incarcare, reincarca } = useApi('/proprietar/anunturi');
  const [ocupat, setOcupat] = useState(null); // id-ul anuntului la care se lucreaza (butoanele lui sunt oprite)
  const [mesaj, setMesaj] = useState(state?.mesaj ? { tip: 'succes', text: state.mesaj } : null);
  const [deSters, setDeSters] = useState(null); // anuntul pentru care e deschisa fereastra "Stergi?"

  async function executa(a, lucru, textReusit) {
    setOcupat(a.id);
    setMesaj(null);
    try {
      const r = await lucru();
      setMesaj({ tip: 'succes', text: textReusit(r) });
      reincarca();
    } catch (e) {
      setMesaj({ tip: 'eroare', text: e.message });
    } finally {
      setOcupat(null);
    }
  }

  const laActiune = (a, cale) => executa(a, () => api.post(`/proprietar/anunturi/${a.id}/${cale}`), ({ date: r }) => (
    r.stare === 'activ' ? `„${a.titlu}” este din nou pe site.`
      : r.stare === 'in_asteptare' ? `„${a.titlu}” a fost trimis spre aprobare.`
        : `„${a.titlu}” a fost scos de pe site.`
  ));
  const confirmaStergerea = () => {
    const a = deSters;
    setDeSters(null);
    executa(a, () => api.delete(`/proprietar/anunturi/${a.id}`), () => `„${a.titlu}” a fost șters.`);
  };

  if (eroare) return <div className="alerta alerta-eroare" role="alert">{eroare.message} <button className="buton buton-moale" type="button" onClick={reincarca}>Reîncearcă</button></div>;
  if (!date) return <div className="lista-schelet">{[1, 2, 3].map((i) => <div key={i} className="card-schelet rand" />)}</div>;

  const { anunturi, limita, mesaj_limita: mesajLimita, are_proprietati_active: areProprietati } = date;
  const procent = limita.maxim ? Math.min(100, Math.round((limita.folosite / limita.maxim) * 100)) : 0;

  return (
    <section aria-busy={incarcare}>
      <div className="bara-zona">
        <div className="limita-plan">
          <span>Anunțuri publicate: <strong>{limita.folosite}{limita.maxim ? ` din ${limita.maxim}` : ''}</strong>{limita.plan ? ` · plan ${limita.plan}` : ''}</span>
          {limita.maxim && <span className="progres" aria-hidden="true"><span style={{ width: `${procent}%` }} /></span>}
        </div>
        {areProprietati
          ? <Link className="buton buton-principal" to="/proprietar/anunturi/nou">+ Anunț nou</Link>
          : <span className="nota">Ca să adaugi un anunț, ai nevoie întâi de o proprietate activă. <Link to="/proprietar/proprietati/nou">Adaugă o proprietate</Link></span>}
      </div>
      {mesajLimita && <p className="nota-stare">{mesajLimita}</p>}

      {mesaj && <div className={`alerta alerta-${mesaj.tip}`} role={mesaj.tip === 'eroare' ? 'alert' : 'status'}>{mesaj.text}</div>}

      {anunturi.length === 0 ? (
        <div className="gol">
          <p><strong>Nu ai încă niciun anunț.</strong></p>
          <p>Un anunț prezintă una dintre proprietățile tale: preț, descriere și poze.</p>
          {areProprietati && <Link className="buton buton-principal" to="/proprietar/anunturi/nou">Creează primul anunț</Link>}
        </div>
      ) : (
        <ul className="lista-anunturi">
          {anunturi.map((a) => (
            <RandAnunt key={a.id} a={a} ocupat={ocupat === a.id} laActiune={laActiune} laStergere={setDeSters} />
          ))}
        </ul>
      )}

      <Fereastra deschisa={Boolean(deSters)} titlu="Ștergi anunțul?" laInchidere={() => setDeSters(null)}>
        <p>„<strong>{deSters?.titlu}</strong>” dispare de pe site și din lista ta. Nu îl mai poți aduce înapoi.</p>
        {(deSters?.stare === 'activ' || deSters?.stare === 'in_asteptare') && (
          <p className="nota">Dacă vrei doar o pauză, folosește <strong>Retrage</strong>: anunțul rămâne la tine și îl poți publica din nou.</p>
        )}
        <div className="butoane-fereastra">
          <button className="buton buton-moale" type="button" onClick={() => setDeSters(null)}>Renunță</button>
          <button className="buton buton-pericol-plin" type="button" onClick={confirmaStergerea}>Da, șterge</button>
        </div>
      </Fereastra>
    </section>
  );
}
