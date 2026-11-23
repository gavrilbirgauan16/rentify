// "Proprietatile mele": locuintele proprietarului (GET /api/proprietar/proprietati), cu limita din plan.
// Dezactivarea scoate proprietatea din uz IMPREUNA cu anunturile ei; activarea verifica limita planului,
// iar anunturile raman inactive (le publica el din nou, cand vrea).
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { api } from '../../api/client.js';
import { useApi } from '../../api/useApi.js';
import Fereastra from '../../componente/Fereastra.jsx';
import { STARI_PROPRIETATE, TIPURI_PROPRIETATE } from '../../utile/formatare.js';

function CardProprietate({ p, ocupat, laActivare, laDezactivare }) {
  const stare = STARI_PROPRIETATE[p.stare];
  const inactiva = p.stare === 'inactiv';
  return (
    <li className={`card-proprietate${inactiva ? ' inactiva' : ''}`}>
      <div className="linie-titlu">
        <h3><Link to={`/proprietar/proprietati/${p.id}`}>{p.denumire}</Link></h3>
        <span className={`insigna ${stare.clasa}`}>{stare.text}</span>
      </div>
      <p className="meta">{TIPURI_PROPRIETATE[p.tip]} · {p.oras}{p.zona ? `, ${p.zona}` : ''} · jud. {p.judet}</p>
      <ul className="caracteristici">
        <li>{p.nr_camere} {p.nr_camere === 1 ? 'cameră' : 'camere'}</li>
        {p.suprafata_mp && <li>{p.suprafata_mp} m²</li>}
        <li>până la {p.max_locatari} {p.max_locatari === 1 ? 'locatar' : 'locatari'}</li>
        {p.are_balcon && <li>balcon</li>}
      </ul>
      <p className="anunturi-active">
        {p.anunturi_active > 0 ? `${p.anunturi_active} ${p.anunturi_active === 1 ? 'anunț activ' : 'anunțuri active'} pe site` : 'Niciun anunț activ'}
      </p>
      <div className="actiuni-card">
        <Link className="buton buton-moale" to={`/proprietar/proprietati/${p.id}`}>Editează</Link>
        {inactiva
          ? <button className="buton buton-moale" type="button" disabled={ocupat} onClick={() => laActivare(p)}>Activează</button>
          : <button className="buton buton-pericol" type="button" disabled={ocupat} onClick={() => laDezactivare(p)}>Dezactivează</button>}
      </div>
    </li>
  );
}

export default function ProprietatileMele() {
  const { state } = useLocation();
  const { date, eroare, incarcare, reincarca } = useApi('/proprietar/proprietati');
  const [ocupat, setOcupat] = useState(null);
  const [mesaj, setMesaj] = useState(state?.mesaj ? { tip: 'succes', text: state.mesaj } : null);
  const [deDezactivat, setDeDezactivat] = useState(null);

  async function executa(p, lucru, textReusit) {
    setOcupat(p.id);
    setMesaj(null);
    try {
      const r = await lucru();
      setMesaj({ tip: 'succes', text: textReusit(r.date) });
      reincarca();
    } catch (e) {
      setMesaj({ tip: 'eroare', text: e.message });
    } finally {
      setOcupat(null);
    }
  }

  const laActivare = (p) => executa(p, () => api.post(`/proprietar/proprietati/${p.id}/activeaza`),
    () => `„${p.denumire}” este din nou activă. Anunțurile ei au rămas inactive: le poți publica din „Anunțurile mele”.`);
  const confirmaDezactivarea = () => {
    const p = deDezactivat;
    setDeDezactivat(null);
    executa(p, () => api.post(`/proprietar/proprietati/${p.id}/dezactiveaza`), (r) => (
      r.anunturi_dezactivate > 0
        ? `„${p.denumire}” a fost dezactivată, împreună cu ${r.anunturi_dezactivate === 1 ? 'un anunț' : `${r.anunturi_dezactivate} anunțuri`}.`
        : `„${p.denumire}” a fost dezactivată.`
    ));
  };

  if (eroare) return <div className="alerta alerta-eroare" role="alert">{eroare.message} <button className="buton buton-moale" type="button" onClick={reincarca}>Reîncearcă</button></div>;
  if (!date) return <div className="lista-schelet">{[1, 2].map((i) => <div key={i} className="card-schelet rand" />)}</div>;

  const { proprietati, limita, mesaj_limita: mesajLimita } = date;
  const procent = limita.maxim ? Math.min(100, Math.round((limita.folosite / limita.maxim) * 100)) : 0;

  return (
    <section aria-busy={incarcare}>
      <div className="bara-zona">
        <div className="limita-plan">
          <span>Proprietăți active: <strong>{limita.folosite}{limita.maxim ? ` din ${limita.maxim}` : ''}</strong>{limita.plan ? ` · plan ${limita.plan}` : ''}</span>
          {limita.maxim && <span className="progres" aria-hidden="true"><span style={{ width: `${procent}%` }} /></span>}
        </div>
        {limita.poate_adauga
          ? <Link className="buton buton-principal" to="/proprietar/proprietati/nou">+ Proprietate nouă</Link>
          : <span className="nota">Ai atins limita planului.</span>}
      </div>
      {mesajLimita && <p className="nota-stare">{mesajLimita}</p>}
      {mesaj && <div className={`alerta alerta-${mesaj.tip}`} role={mesaj.tip === 'eroare' ? 'alert' : 'status'}>{mesaj.text}</div>}

      {proprietati.length === 0 ? (
        <div className="gol">
          <p><strong>Nu ai încă nicio proprietate.</strong></p>
          <p>Adaugă locuința pe care vrei s-o închiriezi; apoi îi poți face un anunț.</p>
          {limita.poate_adauga && <Link className="buton buton-principal" to="/proprietar/proprietati/nou">Adaugă prima proprietate</Link>}
        </div>
      ) : (
        <ul className="grila-proprietati">
          {proprietati.map((p) => (
            <CardProprietate key={p.id} p={p} ocupat={ocupat === p.id} laActivare={laActivare} laDezactivare={setDeDezactivat} />
          ))}
        </ul>
      )}

      <Fereastra deschisa={Boolean(deDezactivat)} titlu="Dezactivezi proprietatea?" laInchidere={() => setDeDezactivat(null)}>
        <p>„<strong>{deDezactivat?.denumire}</strong>” nu mai poate primi anunțuri, iar <strong>anunțurile ei de pe site vor fi scoase</strong>.</p>
        <p className="nota">O poți activa oricând din nou (dacă planul îți permite); anunțurile le publici apoi tu, din „Anunțurile mele”.</p>
        <div className="butoane-fereastra">
          <button className="buton buton-moale" type="button" onClick={() => setDeDezactivat(null)}>Renunță</button>
          <button className="buton buton-pericol-plin" type="button" onClick={confirmaDezactivarea}>Da, dezactivează</button>
        </div>
      </Fereastra>
    </section>
  );
}
