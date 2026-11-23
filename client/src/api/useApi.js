// Hook pentru citirea datelor din API intr-o pagina: useApi('/anunturi?oras=Suceava').
// Intoarce { date, antete, eroare, incarcare, reincarca }. Cand adresa se schimba, cere datele din nou
// si ANULEAZA cererea veche (altfel un raspuns vechi, venit tarziu, ar putea suprascrie unul nou).
// Adresa null = nu cerem nimic (ex. formularul unui anunt NOU nu are ce citi de pe server).
import { useCallback, useEffect, useState } from 'react';
import { api } from './client.js';

export function useApi(adresa) {
  const [rezultat, setRezultat] = useState({ cheie: null, date: null, antete: null, eroare: null });
  const [incercare, setIncercare] = useState(0); // creste la "Reincearca", ca sa ceara din nou aceeasi adresa
  const cheie = adresa ? `${adresa}#${incercare}` : null;

  useEffect(() => {
    if (!adresa) return undefined;
    const anulare = new AbortController();
    api.get(adresa, { semnal: anulare.signal })
      .then(({ date, antete }) => setRezultat({ cheie, date, antete, eroare: null }))
      .catch((e) => {
        if (e.name !== 'AbortError') setRezultat((r) => ({ ...r, cheie, eroare: e }));
      });
    return () => anulare.abort();
  }, [adresa, cheie]);

  const reincarca = useCallback(() => setIncercare((n) => n + 1), []);

  return {
    // Cat timp vine raspunsul nou, pastram datele vechi pe ecran (nu "clipeste" pagina goala).
    date: adresa ? rezultat.date : null,
    antete: rezultat.antete,
    eroare: adresa && rezultat.cheie === cheie ? rezultat.eroare : null,
    incarcare: Boolean(adresa) && rezultat.cheie !== cheie,
    reincarca,
  };
}
