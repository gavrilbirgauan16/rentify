// La pornire intreaba serverul cine e conectat (GET /api/auth/eu) si pune raspunsul in context.
// Tot aici: intrarea in cont si iesirea (singurele actiuni care schimba sesiunea).
// Sesiunea adevarata e pe server (cookie httpOnly - JavaScript nu-l poate citi); aici tinem doar ce ne-a spus serverul.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, seteazaTokenCsrf } from '../api/client.js';
import { SesiuneContext } from './sesiune.js';

export default function SesiuneProvider({ children }) {
  const [stare, setStare] = useState({ verificata: false, utilizator: null });

  useEffect(() => {
    const anulare = new AbortController();
    api.get('/auth/eu', { semnal: anulare.signal })
      .then(({ date }) => setStare({ verificata: true, utilizator: date.utilizator }))
      .catch((e) => {
        // 401 = nu e nimeni conectat; orice alta eroare (ex. server oprit): tratam ca neconectat
        if (e.name !== 'AbortError') setStare({ verificata: true, utilizator: null });
      });
    return () => anulare.abort();
  }, []);

  // Intrarea in cont. La o eroare (parola gresita, cont neconfirmat...) arunca EroareApi; pagina o arata.
  // Dupa login sesiunea e NOUA, deci si tokenul CSRF: serverul ni-l trimite in raspuns.
  const conecteaza = useCallback(async (email, parola) => {
    const { date } = await api.post('/auth/login', { email, parola });
    seteazaTokenCsrf(date.csrfToken);
    setStare({ verificata: true, utilizator: date.utilizator });
    return date.utilizator;
  }, []);

  // Iesirea: serverul sterge sesiunea; aici uitam utilizatorul si tokenul (chiar daca serverul nu raspunde).
  const iesi = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      seteazaTokenCsrf(null);
      setStare({ verificata: true, utilizator: null });
    }
  }, []);

  // useMemo: aceeasi valoare cat timp starea nu se schimba (altfel toate componentele s-ar redesena degeaba)
  const valoare = useMemo(() => ({ ...stare, conecteaza, iesi }), [stare, conecteaza, iesi]);
  return <SesiuneContext.Provider value={valoare}>{children}</SesiuneContext.Provider>;
}
