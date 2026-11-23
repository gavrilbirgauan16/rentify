// Un card centrat pe pagina, pentru paginile scurte ale contului (parola uitata, resetare, confirmare).
// Arata la fel ca fata cardului de "Intra in cont", ca utilizatorul sa simta ca e in acelasi loc.
//   iconita (optional): un simbol mare deasupra titlului (ex. "✉️")
export default function CardSimplu({ titlu, iconita, subtitlu, children }) {
  return (
    <div className="pagina-simpla">
      <section className="card-simplu" aria-labelledby="titlu-card-simplu">
        <div className="titlu-card">
          {iconita && <div className="iconita-mare" aria-hidden="true">{iconita}</div>}
          <h1 id="titlu-card-simplu">{titlu}</h1>
          {subtitlu && <p>{subtitlu}</p>}
        </div>
        {children}
      </section>
    </div>
  );
}
