// Pagina pentru o adresa care nu exista (404) - si pentru o eroare neasteptata intr-o pagina (ErrorBoundary).
import { Link, isRouteErrorResponse, useRouteError } from 'react-router';

export default function NuExista() {
  // useRouteError: daca am ajuns aici din cauza unei erori (nu a unei adrese gresite), o aflam.
  const eroare = useRouteError();
  const neasteptata = eroare && !(isRouteErrorResponse(eroare) && eroare.status === 404);
  if (neasteptata) console.error(eroare); // detaliile tehnice: doar in consola, nu pe ecran

  return (
    <section className="pagina-mesaj">
      <p className="cod">{neasteptata ? 'Oops' : '404'}</p>
      <h1>{neasteptata ? 'Ceva n-a mers bine' : 'Pagina nu există'}</h1>
      <p>{neasteptata
        ? 'A apărut o eroare neașteptată. Reîncarcă pagina sau întoarce-te la prima pagină.'
        : 'Adresa poate fi greșită, sau pagina a fost mutată.'}</p>
      <Link className="buton buton-principal" to="/">Înapoi la prima pagină</Link>
    </section>
  );
}
