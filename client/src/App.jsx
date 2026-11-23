// Prima componenta: verifica legatura cu serverul. La pornire intreaba API-ul "cine e conectat?"
// (GET /api/auth/eu) si arata raspunsul. (Pasul urmator: meniul, paginile si login-ul.)
import { useEffect, useState } from 'react';

export default function App() {
  // Starea componentei: ce stim acum. Cand se schimba (setStare), React redeseneaza componenta.
  const [stare, setStare] = useState({ tip: 'incarcare' });

  // useEffect: cod care ruleaza DUPA ce componenta apare pe ecran (aici: o cerere catre API).
  useEffect(() => {
    // AbortController: daca componenta dispare inainte sa vina raspunsul, anulam cererea.
    const anulare = new AbortController();
    fetch('/api/auth/eu', { signal: anulare.signal })
      .then(async (r) => {
        if (r.status === 401) return setStare({ tip: 'neconectat' });
        if (!r.ok) throw new Error(`Serverul a răspuns cu ${r.status}`);
        const date = await r.json();
        setStare({ tip: 'conectat', utilizator: date.utilizator });
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setStare({ tip: 'eroare', mesaj: e.message });
      });
    return () => anulare.abort(); // "curatenia": ruleaza cand componenta dispare
  }, []); // [] = o singura data, la pornire

  return (
    <main>
      <h1>Rentify</h1>
      {stare.tip === 'incarcare' && <p>Se verifică legătura cu serverul…</p>}
      {stare.tip === 'neconectat' && <p>Legătura cu serverul merge. Nu ești conectat.</p>}
      {stare.tip === 'conectat' && (
        <p>Legătura cu serverul merge. Ești conectat ca <strong>{stare.utilizator.prenume}</strong> ({stare.utilizator.rol}).</p>
      )}
      {stare.tip === 'eroare' && (
        <p role="alert">Nu pot ajunge la server ({stare.mesaj}). Pornește serverul cu <code>npm run dev</code>.</p>
      )}
    </main>
  );
}
