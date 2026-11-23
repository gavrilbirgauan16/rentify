// La pornire intreaba serverul cine e conectat (GET /api/auth/eu) si pune raspunsul in context.
// Sesiunea adevarata e pe server (cookie httpOnly - JavaScript nu-l poate citi); aici tinem doar ce ne-a spus serverul.
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
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

  // useMemo: aceeasi valoare cat timp starea nu se schimba (altfel toate componentele s-ar redesena degeaba)
  const valoare = useMemo(() => ({ ...stare }), [stare]);
  return <SesiuneContext.Provider value={valoare}>{children}</SesiuneContext.Provider>;
}
