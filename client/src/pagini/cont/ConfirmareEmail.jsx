// Confirmarea adresei NOI de email, din linkul trimis pe ea (/cont/email/confirmare/:token).
// POST /api/cont/email/confirmare - merge si fara sa fii conectat (poti deschide linkul pe telefon).
// Ca la activarea contului: pagina trimite tokenul o singura data (StrictMode porneste efectele de doua ori).
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../../api/client.js';
import { useSesiune } from '../../sesiune/sesiune.js';
import CardSimplu from '../../componente/CardSimplu.jsx';

const cereri = new Map();
function confirma(token) {
  if (!cereri.has(token)) cereri.set(token, api.post('/cont/email/confirmare', { token }));
  return cereri.get(token);
}

export default function ConfirmareEmail() {
  const { token } = useParams();
  const { utilizator, reimprospateaza } = useSesiune();
  const [rezultat, setRezultat] = useState(null);

  useEffect(() => {
    let activ = true;
    confirma(token)
      .then(({ date }) => {
        if (!activ) return;
        setRezultat({ ok: true, mesaj: date.mesaj });
        reimprospateaza(); // daca e conectat in acest browser, contul are acum adresa noua
      })
      .catch((e) => activ && setRezultat({ ok: false, mesaj: e.message }));
    return () => { activ = false; };
  }, [token, reimprospateaza]);

  const inainte = utilizator ? <Link className="buton buton-principal buton-lat" to="/cont">Mergi la contul meu</Link>
    : <Link className="buton buton-principal buton-lat" to="/intrare">Intră în cont</Link>;

  if (!rezultat) return <CardSimplu iconita="⏳" titlu="Confirmăm adresa…"><p className="nota" role="status">Un moment.</p></CardSimplu>;
  if (rezultat.ok) {
    return (
      <CardSimplu iconita="✅" titlu="Adresă confirmată">
        <p className="nota" role="status">{rezultat.mesaj} De acum te conectezi cu ea.</p>
        {inainte}
      </CardSimplu>
    );
  }
  return (
    <CardSimplu iconita="⏳" titlu="Linkul nu mai e valabil">
      <p className="nota" role="alert">{rezultat.mesaj}</p>
      <p className="nota">Poți cere din nou schimbarea adresei din „Contul meu”.</p>
      {inainte}
    </CardSimplu>
  );
}
