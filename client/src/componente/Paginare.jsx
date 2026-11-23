// Numerele de pagina: ‹ 1 … 4 5 6 … 12 ›. Fiecare e un LINK adevarat (adresa cu ?pagina=5): merge "Inapoi",
// se poate deschide intr-o fila noua sau trimite cuiva. adresaPentru(nr) da adresa paginii nr.
import { Link } from 'react-router';

// Ce numere aratam: prima, ultima si cate 1 de o parte si de alta a celei curente; restul devin "…".
function numere(pagina, total) {
  const set = new Set([1, total, pagina - 1, pagina, pagina + 1].filter((n) => n >= 1 && n <= total));
  const sortate = [...set].sort((a, b) => a - b);
  const rezultat = [];
  sortate.forEach((n, i) => {
    if (i > 0 && n - sortate[i - 1] > 1) rezultat.push('…');
    rezultat.push(n);
  });
  return rezultat;
}

export default function Paginare({ pagina, totalPagini, adresaPentru }) {
  if (totalPagini <= 1) return null;
  return (
    <nav className="paginare" aria-label="Paginile cu rezultate">
      {pagina > 1
        ? <Link to={adresaPentru(pagina - 1)} aria-label="Pagina anterioară">‹</Link>
        : <span className="dezactivat" aria-hidden="true">‹</span>}
      {numere(pagina, totalPagini).map((n, i) => (n === '…'
        ? <span key={`p${i}`} className="puncte" aria-hidden="true">…</span>
        : <Link key={n} to={adresaPentru(n)} aria-current={n === pagina ? 'page' : undefined} aria-label={`Pagina ${n}`}>{n}</Link>))}
      {pagina < totalPagini
        ? <Link to={adresaPentru(pagina + 1)} aria-label="Pagina următoare">›</Link>
        : <span className="dezactivat" aria-hidden="true">›</span>}
    </nav>
  );
}
