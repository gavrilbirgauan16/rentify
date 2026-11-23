// "Abonamentul meu" (GET /api/proprietar/abonament): planul curent, cat a folosit din limite, planurile pentru
// proprietari si istoricul. Butoanele "Alege" duc la pagina de confirmare, unde SERVERUL calculeaza pretul.
// Schimbarea programata (ex. un plan mai mic, de la finalul perioadei) se poate anula de aici.
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { api } from '../../api/client.js';
import { useApi } from '../../api/useApi.js';
import Fereastra from '../../componente/Fereastra.jsx';
import { dataAfisata, lei, STARI_ABONAMENT } from '../../utile/formatare.js';

const insignaStare = (cod) => STARI_ABONAMENT[cod] ?? { text: cod, clasa: 'insigna-ciorna' };

// Cate zile mai are abonamentul (inclusiv azi), din data de final "AAAA-LL-ZZ".
function zileRamase(dataSfarsit) {
  const [an, luna, zi] = dataSfarsit.split('-').map(Number);
  const azi = new Date();
  const dif = new Date(an, luna - 1, zi) - new Date(azi.getFullYear(), azi.getMonth(), azi.getDate());
  return Math.max(0, Math.round(dif / 86_400_000) + 1);
}

// O bara "folosite din maxim" (proprietati / anunturi). maxim null = nelimitat.
function Limita({ eticheta, l }) {
  const depaseste = l.maxim !== null && l.folosite > l.maxim;
  const procent = l.maxim ? Math.min(100, Math.round((l.folosite / l.maxim) * 100)) : 0;
  return (
    <div className="limita-abonament">
      <div className="linie-limita">
        <span>{eticheta}</span>
        <strong>{l.maxim === null ? `${l.folosite} (fără limită)` : `${l.folosite} din ${l.maxim}`}</strong>
      </div>
      {l.maxim !== null && (
        <span className={`progres lat${depaseste ? ' depasit' : ''}`} role="progressbar" aria-label={eticheta}
          aria-valuenow={procent} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${procent}%` }} />
        </span>
      )}
      {depaseste && <p className="nota nota-pericol">Peste limita planului: ce ai rămâne, dar nu poți adăuga altele.</p>}
    </div>
  );
}

// Cardul unui plan. La planul curent se poate trece doar pe cealalta perioada (lunar <-> anual);
// planul gratuit are o singura perioada (anual, fara plata).
function CardPlan({ p, curent }) {
  const alMeu = curent?.plan_id === p.id;
  let perioade = p.gratuit ? ['anual'] : ['lunar', 'anual'];
  if (alMeu) perioade = perioade.filter((x) => x !== curent.perioada);
  const economie = p.pret_lunar * 12 - p.pret_anual;
  const adresa = (perioada) => `/proprietar/abonament/schimba?plan=${p.id}&perioada=${perioada}`;

  return (
    <li className={`card-plan${p.recomandat ? ' recomandat' : ''}${alMeu ? ' al-meu' : ''}`}>
      {p.recomandat && <span className="eticheta-plan">Recomandat</span>}
      <div className="linie-titlu">
        <h3>{p.nume}</h3>
        {alMeu && <span className="insigna insigna-activ">Planul tău</span>}
        {!p.activ && <span className="insigna insigna-inactiv">Nu mai e oferit</span>}
      </div>
      {p.descriere && <p className="nota">{p.descriere}</p>}

      {p.gratuit ? (
        <p className="pret-plan">Gratuit <small>fără card, fără obligații</small></p>
      ) : (
        <p className="pret-plan">
          {lei(p.pret_lunar)} <small>/ lună</small>
          <span className="pret-anual">sau {lei(p.pret_anual)} / an{economie > 0 && <> · <strong>economisești {lei(economie)}</strong></>}</span>
        </p>
      )}

      <ul className="beneficii">
        {p.caracteristici.map((c) => (
          <li key={c.text} className={c.inclus ? '' : 'neinclus'}>
            <span className="semn" aria-hidden="true">{c.inclus ? '✓' : '✕'}</span>
            <span className="ascuns-vizual">{c.inclus ? 'Inclus: ' : 'Nu include: '}</span>
            {c.text}
          </li>
        ))}
      </ul>

      <div className="actiuni-plan">
        {alMeu && <span className="buton buton-moale dezactivat" aria-disabled="true">Planul tău actual</span>}
        {p.activ && perioade.map((per) => (
          <Link key={per} className={`buton ${alMeu ? 'buton-moale' : 'buton-principal'}`} to={adresa(per)}>
            {alMeu ? `Treci pe plata ${per === 'anual' ? 'anuală' : 'lunară'}` : p.gratuit ? 'Alege planul gratuit' : `Alege ${per}`}
          </Link>
        ))}
      </div>
    </li>
  );
}

export default function AbonamentulMeu() {
  const { state } = useLocation();
  const { date, eroare, incarcare, reincarca } = useApi('/proprietar/abonament');
  const [mesaj, setMesaj] = useState(state?.mesaj ? { tip: 'succes', text: state.mesaj } : null);
  const [renunta, setRenunta] = useState(false);
  const [ocupat, setOcupat] = useState(false);

  async function anuleazaProgramat() {
    setRenunta(false);
    setOcupat(true);
    setMesaj(null);
    try {
      await api.delete('/proprietar/abonament/programat');
      setMesaj({ tip: 'succes', text: 'Ai renunțat la schimbarea programată. Plățile ei au fost rambursate; păstrezi planul actual.' });
      reincarca();
    } catch (e) {
      setMesaj({ tip: 'eroare', text: e.message });
    } finally {
      setOcupat(false);
    }
  }

  if (eroare) return <div className="alerta alerta-eroare" role="alert">{eroare.message} <button className="buton buton-moale" type="button" onClick={reincarca}>Reîncearcă</button></div>;
  if (!date) return <div className="lista-schelet">{[1, 2, 3].map((i) => <div key={i} className="card-schelet rand" />)}</div>;

  const { curent, programat, limite, planuri, istoric } = date;
  const stare = curent && insignaStare(curent.stare);

  return (
    <section aria-busy={incarcare}>
      {mesaj && <div className={`alerta alerta-${mesaj.tip}`} role={mesaj.tip === 'eroare' ? 'alert' : 'status'}>{mesaj.text}</div>}

      {programat && (
        <div className="nota-stare programat">
          <span>
            De pe <strong>{dataAfisata(programat.data_inceput)}</strong> treci pe planul <strong>{programat.plan}</strong> ({programat.perioada}, {lei(programat.valoare)}).
            Până atunci păstrezi planul actual.
          </span>
          <button className="buton buton-moale" type="button" disabled={ocupat} onClick={() => setRenunta(true)}>Renunță la schimbare</button>
        </div>
      )}

      <div className="grila-abonament">
        <article className="card-abonament">
          {curent ? (
            <>
              <p className="supratitlu">Planul tău</p>
              <div className="linie-titlu"><h2>{curent.plan}</h2><span className={`insigna ${stare.clasa}`}>{stare.text}</span></div>
              <dl className="detalii-abonament">
                <dt>Perioada</dt><dd>{dataAfisata(curent.data_inceput)} – {dataAfisata(curent.data_sfarsit)}</dd>
                <dt>Mai sunt</dt><dd>{zileRamase(curent.data_sfarsit)} {zileRamase(curent.data_sfarsit) === 1 ? 'zi' : 'zile'}</dd>
                <dt>Plată</dt><dd>{curent.perioada === 'anual' ? 'Anual' : 'Lunar'} · {curent.valoare > 0 ? lei(curent.valoare) : 'gratuit'}</dd>
                <dt>Reînnoire</dt><dd>{curent.reinnoire_automata ? 'automată' : 'manuală'}</dd>
              </dl>
            </>
          ) : (
            <>
              <h2>Nu ai un abonament în curs</h2>
              <p className="nota">Fără abonament nu poți avea proprietăți sau anunțuri active. Alege un plan mai jos.</p>
            </>
          )}
        </article>
        <article className="card-abonament">
          <p className="supratitlu">Ce ai folosit din plan</p>
          <Limita eticheta="Proprietăți active" l={limite.proprietati} />
          <Limita eticheta="Anunțuri active și în așteptare" l={limite.anunturi} />
        </article>
      </div>

      <h2 className="titlu-abonament">Planuri pentru proprietari</h2>
      <ul className="grila-planuri">
        {planuri.map((p) => <CardPlan key={p.id} p={p} curent={curent} />)}
      </ul>

      {istoric.length > 0 && (
        <>
          <h2 className="titlu-abonament">Istoric</h2>
          <div className="tabel-derulant">
            <table className="tabel">
              <thead><tr><th scope="col">Plan</th><th scope="col">Perioada</th><th scope="col">Valoare</th><th scope="col">Stare</th></tr></thead>
              <tbody>
                {istoric.map((a) => {
                  const s = insignaStare(a.stare);
                  return (
                    <tr key={a.id}>
                      <td>{a.plan} <span className="nota">({a.perioada})</span></td>
                      <td className="fara-rupere">{dataAfisata(a.data_inceput)} – {dataAfisata(a.data_sfarsit)}</td>
                      <td>{a.valoare > 0 ? lei(a.valoare) : 'gratuit'}</td>
                      <td><span className={`insigna ${s.clasa}`}>{s.text}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Fereastra deschisa={renunta} titlu="Renunți la schimbarea programată?" laInchidere={() => setRenunta(false)}>
        <p>Rămâi pe planul actual și după <strong>{curent && dataAfisata(curent.data_sfarsit)}</strong>. Ce ai plătit pentru planul programat ți se rambursează.</p>
        <div className="butoane-fereastra">
          <button className="buton buton-moale" type="button" onClick={() => setRenunta(false)}>Nu, păstrez schimbarea</button>
          <button className="buton buton-principal" type="button" onClick={anuleazaProgramat}>Da, renunț</button>
        </div>
      </Fereastra>
    </section>
  );
}
