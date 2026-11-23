// Paginile care cer un cont (si, optional, un anumit rol). Cine nu e conectat ajunge la "Intra in cont",
// iar dupa login revine exact la pagina ceruta (adresa ei e trimisa in "state.de").
// ATENTIE: asta e doar pentru o experienta buna. Protectia ADEVARATA e pe server: API-ul verifica sesiunea
// si rolul la fiecare cerere (cineva poate ocoli oricand codul din browser).
import { Link, Navigate, Outlet, useLocation } from 'react-router';
import { useSesiune } from '../sesiune/sesiune.js';

export default function RutaProtejata({ rol }) {
  const { verificata, utilizator } = useSesiune();
  const { pathname, search } = useLocation();

  if (!verificata) return null; // inca intrebam serverul (se vede ecranul de intrare)
  if (!utilizator) return <Navigate to="/intrare" replace state={{ de: pathname + search }} />;
  if (rol && utilizator.rol !== rol) {
    return (
      <section className="pagina-mesaj">
        <p className="cod" aria-hidden="true">🔒</p>
        <h1>Pagina nu e pentru contul tău</h1>
        <p>Această parte a aplicației e doar pentru conturile de {rol === 'proprietar' ? 'proprietar' : rol}.</p>
        <Link className="buton buton-principal" to="/">Înapoi la prima pagină</Link>
      </section>
    );
  }
  return <Outlet />;
}
