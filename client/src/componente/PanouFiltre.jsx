// Filtrele cautarii. Valorile pornesc din ADRESA paginii (parametri), iar la "Arata rezultatele" se scriu inapoi
// in adresa (laAplicare) - deci cautarea se poate salva, trimite, iar "Inapoi" din browser merge.
// Formularul e "necontrolat" (browserul tine valorile); key-ul de afara il reface cand adresa se schimba.
import { Camp } from './Camp.jsx';

export default function PanouFiltre({ parametri, laAplicare, laStergere }) {
  const v = (nume) => parametri.get(nume) ?? '';

  function trimite(e) {
    e.preventDefault();
    const noi = new URLSearchParams();
    for (const [cheie, valoare] of new FormData(e.currentTarget)) if (String(valoare).trim()) noi.set(cheie, String(valoare).trim());
    laAplicare(noi);
  }

  return (
    <form className="panou-filtre" onSubmit={trimite} role="search" aria-label="Filtrele căutării">
      <Camp eticheta="Cuvinte" name="q" type="search" defaultValue={v('q')} placeholder="ex. balcon, centru, renovat" />
      <Camp eticheta="Oraș" name="oras" defaultValue={v('oras')} placeholder="ex. Suceava" />

      <fieldset className="grup-filtru">
        <legend>Tip</legend>
        <div className="optiuni-pastila">
          {[['', 'Oricare'], ['inchiriere', 'Închiriere'], ['vanzare', 'Vânzare']].map(([valoare, text]) => (
            <label key={valoare || 'oricare'}>
              <input type="radio" name="tip" value={valoare} defaultChecked={v('tip') === valoare} />
              <span>{text}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="grup-filtru">
        <legend>Preț (lei)</legend>
        <div className="rand-doi">
          <Camp eticheta="de la" name="pret_min" type="number" min="0" inputMode="numeric" defaultValue={v('pret_min')} placeholder="0" />
          <Camp eticheta="până la" name="pret_max" type="number" min="0" inputMode="numeric" defaultValue={v('pret_max')} placeholder="oricât" />
        </div>
      </fieldset>

      <fieldset className="grup-filtru">
        <legend>Camere</legend>
        <div className="optiuni-pastila">
          {[['', 'Oricâte'], ['1', '1+'], ['2', '2+'], ['3', '3+'], ['4', '4+']].map(([valoare, text]) => (
            <label key={valoare || 'oricate'}>
              <input type="radio" name="camere_min" value={valoare} defaultChecked={v('camere_min') === valoare} />
              <span>{text}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Camp eticheta="Câte persoane locuiesc" name="persoane" type="number" min="1" max="20" inputMode="numeric"
        defaultValue={v('persoane')} placeholder="ex. 2" ajutor="Arătăm doar locuințele în care încăpeți toți." />

      <div className="butoane-filtre">
        <button className="buton buton-principal buton-lat" type="submit">Arată rezultatele</button>
        <button className="buton buton-moale buton-lat" type="button" onClick={laStergere}>Șterge filtrele</button>
      </div>
    </form>
  );
}
