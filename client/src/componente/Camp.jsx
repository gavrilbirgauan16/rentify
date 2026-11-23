// Campuri de formular reutilizabile: eticheta + casuta + mesajul de eroare de sub ea.
// Eroarea e legata de casuta (aria-describedby, aria-invalid): cititorul de ecran o citeste cand ajungi in camp.
import { useId, useState } from 'react';

// buton (optional): un buton afisat IN casuta, la dreapta (ex. "Arata" la parola).
export function Camp({ eticheta, eroare, ajutor, buton, className = '', ...atribute }) {
  const id = useId(); // un id unic, generat de React (doua formulare pe pagina nu se incurca)
  const idMesaj = `${id}-mesaj`;
  const mesaj = eroare || ajutor;
  return (
    <div className={`camp${eroare ? ' cu-eroare' : ''} ${className}`}>
      <label htmlFor={id}>{eticheta}</label>
      <div className={buton ? 'intrare-cu-buton' : undefined}>
        <input id={id} className="intrare" aria-invalid={eroare ? true : undefined}
          aria-describedby={mesaj ? idMesaj : undefined} {...atribute} />
        {buton}
      </div>
      {mesaj && <span id={idMesaj} className={eroare ? 'eroare' : 'ajutor'}>{mesaj}</span>}
    </div>
  );
}

// Parola, cu butonul "Arata / Ascunde" (sa vezi ce ai scris, mai ales pe telefon).
export function CampParola(props) {
  const [vizibila, setVizibila] = useState(false);
  const buton = (
    <button type="button" className="buton-in-camp" onClick={() => setVizibila((v) => !v)}
      aria-label={vizibila ? 'Ascunde parola' : 'Arată parola'} aria-pressed={vizibila}>
      {vizibila ? 'Ascunde' : 'Arată'}
    </button>
  );
  return <Camp {...props} type={vizibila ? 'text' : 'password'} buton={buton} />;
}
