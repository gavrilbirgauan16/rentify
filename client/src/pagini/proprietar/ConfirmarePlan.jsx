// Confirmarea schimbarii planului: /proprietar/abonament/schimba?plan=3&perioada=lunar.
// Pretul, creditul si datele le calculeaza SERVERUL (GET .../previzualizare); pagina doar le arata.
// La plata trimitem DOAR planul si perioada - serverul recalculeaza totul (orice pret trimis de browser e ignorat).
// Plata e SIMULATA (proiect de facultate): nu se cer si nu se salveaza date de card.
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api } from '../../api/client.js';
import { useApi } from '../../api/useApi.js';
import { dataAfisata, lei } from '../../utile/formatare.js';

const TITLURI = { nou: 'Alegi un plan', upgrade: 'Treci la un plan mai mare', downgrade: 'Treci la un plan mai mic' };

export default function ConfirmarePlan() {
  const [cautare] = useSearchParams();
  const navigheaza = useNavigate();
  const plan = cautare.get('plan') ?? '';
  const perioada = cautare.get('perioada') ?? '';
  const calcul = useApi(`/proprietar/abonament/previzualizare?${new URLSearchParams({ plan, perioada })}`);
  const situatie = useApi('/proprietar/abonament'); // pentru "De pe planul X" si data de final a planului actual
  const [ocupat, setOcupat] = useState(false);
  const [eroare, setEroare] = useState(null);

  async function plateste() {
    setOcupat(true); // butonul se blocheaza: un dublu-clic nu plateste de doua ori (si serverul verifica asta)
    setEroare(null);
    try {
      const { date } = await api.post('/proprietar/abonament/schimba', { plan: Number(plan), perioada });
      navigheaza('/proprietar/abonament', { state: { mesaj: date.mesaj } });
    } catch (e) {
      setEroare(e);
      setOcupat(false);
    }
  }

  const inapoi = <Link className="buton buton-moale" to="/proprietar/abonament">← Înapoi la abonament</Link>;
  if (calcul.eroare) {
    // 400: plan inexistent / inactiv / perioada gresita (ex. cineva a schimbat adresa de mana)
    return <div className="confirmare-plan"><div className="alerta alerta-eroare" role="alert">{calcul.eroare.message}</div>{inapoi}</div>;
  }
  if (!calcul.date || !situatie.date) return <div className="lista-schelet"><div className="card-schelet formular" /></div>;

  const c = calcul.date;
  const curent = situatie.date.curent;
  const textPerioada = c.perioada === 'anual' ? 'anuală' : 'lunară';

  return (
    <article className="confirmare-plan card-abonament">
      <nav className="fir-ariadna" aria-label="Unde ești"><Link to="/proprietar/abonament">Abonamentul meu</Link> <span aria-hidden="true">›</span> Confirmă</nav>
      <h2>{TITLURI[c.tip] ?? 'Confirmă planul'}</h2>
      <p className="nota">
        {curent ? <>De pe <strong>{curent.plan}</strong> ({curent.perioada}) pe </> : 'Planul '}
        <strong>{c.plan.nume}</strong>, plată {textPerioada}.
      </p>

      <dl className="calcul-plata">
        <dt>Prețul planului {c.plan.nume} ({c.perioada})</dt><dd>{lei(c.pret_intreg)}</dd>
        {c.credit > 0 && <><dt>Credit din planul actual <small>(zilele plătite și nefolosite)</small></dt><dd className="credit">− {lei(c.credit)}</dd></>}
        <dt className="total">De plată acum</dt><dd className="total">{c.de_plata > 0 ? lei(c.de_plata) : 'Nimic'}</dd>
      </dl>

      <ul className="explicatii-plata">
        {c.tip === 'downgrade' ? (
          <>
            <li>Planul actual rămâne până pe <strong>{dataAfisata(curent?.data_sfarsit)}</strong> (l-ai plătit deja).</li>
            <li>Planul {c.plan.nume} începe pe <strong>{dataAfisata(c.data_inceput)}</strong> și ține până pe {dataAfisata(c.data_sfarsit)}.</li>
            <li>Dacă te răzgândești înainte să înceapă, poți renunța la schimbare și primești banii înapoi.</li>
            <li>Ce ai peste limitele planului nou rămâne, dar nu vei putea adăuga altele.</li>
          </>
        ) : (
          <>
            <li>Planul {c.plan.nume} începe <strong>azi</strong> și ține până pe <strong>{dataAfisata(c.data_sfarsit)}</strong>.</li>
            {curent && <li>Planul actual se oprește azi{c.credit > 0 ? '; zilele rămase s-au scăzut din preț' : ''}.</li>}
          </>
        )}
        <li>Abonamentul se reînnoiește automat la final; îl poți schimba oricând.</li>
      </ul>

      {eroare && (
        <div className="alerta alerta-eroare" role="alert">
          {eroare.message}
          {/* 409: abonamentul s-a schimbat intre timp (alt tab / alt dispozitiv) -> recitim calculul */}
          {eroare.status === 409 && <> <button className="buton buton-moale" type="button" onClick={() => { setEroare(null); calcul.reincarca(); situatie.reincarca(); }}>Recalculează</button></>}
        </div>
      )}

      <div className="actiuni-confirmare">
        <button className="buton buton-principal" type="button" disabled={ocupat} onClick={plateste}>
          {ocupat ? 'Se procesează…' : c.de_plata > 0 ? `Plătește ${lei(c.de_plata)}` : 'Confirmă'}
        </button>
        <Link className="buton buton-moale" to="/proprietar/abonament">Renunță</Link>
      </div>
      {c.de_plata > 0 && (
        <p className="nota">
          Plată <strong>simulată</strong> (proiect de facultate): nu se cer și nu se salvează date de card.
          Într-o aplicație reală, aici te-ar trimite la un procesator de plăți (de ex. Stripe sau Netopia).
        </p>
      )}
    </article>
  );
}
