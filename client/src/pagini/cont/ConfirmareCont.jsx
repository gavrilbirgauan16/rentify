// Activarea contului din linkul primit pe email (/confirmare/:token): pagina trimite tokenul la
// POST /api/auth/confirmare si arata rezultatul. Linkul se poate folosi O SINGURA data.
//
// De ce POST (din pagina) si nu direct un GET pe link: unele programe de email / antivirus "deschid" singure
// linkurile ca sa le verifice. Un GET ar consuma linkul inainte ca omul sa-l apese; pagina noastra, insa,
// trimite tokenul doar cand ruleaza cu adevarat in browser.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../../api/client.js';
import CardSimplu from '../../componente/CardSimplu.jsx';

// O singura cerere pe token, tinuta minte IN AFARA componentei. In timpul lucrului (StrictMode), React
// porneste efectele de doua ori: fara asta, a doua cerere ar gasi linkul deja folosit si ar arata "link expirat".
const cereri = new Map();
function confirma(token) {
  if (!cereri.has(token)) cereri.set(token, api.post('/auth/confirmare', { token }));
  return cereri.get(token);
}

export default function ConfirmareCont() {
  const { token } = useParams();
  const [rezultat, setRezultat] = useState(null); // { ok, mesaj }

  useEffect(() => {
    let activ = true; // daca utilizatorul pleaca de pe pagina, nu mai schimbam starea
    confirma(token)
      .then(({ date }) => activ && setRezultat({ ok: true, mesaj: date.mesaj }))
      .catch((e) => activ && setRezultat({ ok: false, mesaj: e.message }));
    return () => { activ = false; };
  }, [token]);

  if (!rezultat) {
    return <CardSimplu iconita="⏳" titlu="Îți activăm contul…"><p className="nota" role="status">Un moment.</p></CardSimplu>;
  }
  if (rezultat.ok) {
    return (
      <CardSimplu iconita="✅" titlu="Cont activat">
        <p className="nota" role="status">{rezultat.mesaj}</p>
        <Link className="buton buton-principal buton-lat" to="/intrare">Intră în cont</Link>
      </CardSimplu>
    );
  }
  return (
    <CardSimplu iconita="⏳" titlu="Linkul nu mai e valabil">
      <p className="nota" role="alert">{rezultat.mesaj}</p>
      <p className="nota">Dacă ți-ai activat deja contul, te poți conecta. Altfel, la „Intră în cont” poți cere un link nou.</p>
      <Link className="buton buton-principal buton-lat" to="/intrare">Intră în cont</Link>
    </CardSimplu>
  );
}
