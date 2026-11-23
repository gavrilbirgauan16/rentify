// Pozele unui anunt: le tragi in zona (drag & drop) sau apesi "Alege poze"; fiecare are un X pentru stergere.
//  - existente: pozele deja salvate pe server [{ id, url }]
//  - locale:    fisierele alese, inca netrimise (la un anunt NOU se trimit dupa ce se salveaza anuntul) [File]
// Limitele se verifica si aici (raspuns imediat), dar serverul le verifica din nou - inclusiv CONTINUTUL fisierului.
import { useEffect, useRef, useState } from 'react';

const MAX_POZE = 6; // aceleasi limite ca pe server (middleware/incarcareImagini.js)
const MAX_MB = 5;
const TIPURI = ['image/jpeg', 'image/png', 'image/webp'];

// Previzualizarea unui fisier inca netrimis: un URL temporar spre fisierul din memorie, eliberat cand nu mai trebuie.
// URL-ul se creeaza si se elibereaza in ACELASI efect (corect si cand React reface efectele, ca in StrictMode).
function PozaLocala({ fisier, laStergere, ocupat }) {
  const img = useRef(null);
  useEffect(() => {
    const url = URL.createObjectURL(fisier);
    img.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [fisier]);
  return (
    <li className="poza-mica">
      <img ref={img} alt={fisier.name} />
      <span className="eticheta-poza">netrimisă</span>
      <button type="button" className="sterge-poza" onClick={laStergere} disabled={ocupat} aria-label={`Scoate poza ${fisier.name}`}>✕</button>
    </li>
  );
}

export default function ZonaPoze({ existente = [], locale = [], laAlegere, laStergereExistenta, laStergereLocala, ocupat = false, eroare }) {
  const intrare = useRef(null);
  const [trage, setTrage] = useState(false); // un fisier e tras deasupra zonei
  const [problema, setProblema] = useState(null);
  const total = existente.length + locale.length;
  const ramase = MAX_POZE - total;

  // Filtram fisierele alese: tip, marime, cate mai incap. Le pastram pe cele bune si spunem ce n-a mers.
  function primeste(lista) {
    const fisiere = Array.from(lista);
    const bune = fisiere.filter((f) => TIPURI.includes(f.type) && f.size <= MAX_MB * 1024 * 1024).slice(0, Math.max(ramase, 0));
    const respinse = fisiere.length - bune.length;
    setProblema(respinse > 0
      ? `${respinse === 1 ? 'O poză n-a fost adăugată' : `${respinse} poze n-au fost adăugate`}: doar JPG, PNG sau WEBP, de cel mult ${MAX_MB} MB, maximum ${MAX_POZE} poze.`
      : null);
    if (bune.length > 0) laAlegere(bune);
  }

  return (
    <div className="zona-poze">
      <ul className="grila-poze" aria-label="Pozele anunțului">
        {existente.map((p) => (
          <li key={p.id} className="poza-mica">
            <img src={p.url} alt="" />
            <button type="button" className="sterge-poza" onClick={() => laStergereExistenta(p)} disabled={ocupat} aria-label="Șterge poza">✕</button>
          </li>
        ))}
        {locale.map((f, i) => (
          <PozaLocala key={`${f.name}-${f.size}-${i}`} fisier={f} ocupat={ocupat} laStergere={() => laStergereLocala(i)} />
        ))}
      </ul>

      {ramase > 0 && (
        <div className={`zona-tragere${trage ? ' activa' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setTrage(true); }}
          onDragLeave={() => setTrage(false)}
          onDrop={(e) => { e.preventDefault(); setTrage(false); if (!ocupat) primeste(e.dataTransfer.files); }}>
          <span className="iconita-tragere" aria-hidden="true">🖼️</span>
          <p><strong>Trage pozele aici</strong> sau</p>
          <button type="button" className="buton buton-moale" onClick={() => intrare.current.click()} disabled={ocupat}>
            {ocupat ? 'Se trimit…' : 'Alege poze'}
          </button>
          <small>JPG, PNG sau WEBP, cel mult {MAX_MB} MB fiecare · mai poți adăuga {ramase} din {MAX_POZE}</small>
          {/* inputul adevarat e ascuns; il deschide butonul de mai sus */}
          <input ref={intrare} type="file" accept={TIPURI.join(',')} multiple hidden
            onChange={(e) => { primeste(e.target.files); e.target.value = ''; }} />
        </div>
      )}
      {(problema || eroare) && <p className="eroare-separata" role="alert">{eroare || problema}</p>}
    </div>
  );
}
