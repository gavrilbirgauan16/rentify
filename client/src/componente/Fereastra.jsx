// Fereastra peste pagina (ex. "Stergi anuntul?"), facuta cu elementul HTML5 <dialog>.
// showModal() ii da browserului tot ce trebuie: fundal intunecat, focusul ramane in fereastra (Tab nu iese din ea),
// Escape o inchide, iar restul paginii nu poate fi apasat cat timp e deschisa.
import { useEffect, useId, useRef } from 'react';

export default function Fereastra({ deschisa, titlu, laInchidere, children }) {
  const ref = useRef(null);
  const idTitlu = useId();

  // Sincronizam elementul <dialog> cu "deschisa" (dialogul se deschide / inchide prin metode, nu prin atribute).
  useEffect(() => {
    const d = ref.current;
    if (deschisa && !d.open) d.showModal();
    if (!deschisa && d.open) d.close();
  }, [deschisa]);

  return (
    <dialog ref={ref} className="fereastra" aria-labelledby={idTitlu} onClose={laInchidere}
      // clic pe fundalul intunecat (in afara continutului) = inchide
      onClick={(e) => { if (e.target === ref.current) laInchidere(); }}>
      <div className="fereastra-continut">
        <h2 id={idTitlu}>{titlu}</h2>
        {children}
      </div>
    </dialog>
  );
}
