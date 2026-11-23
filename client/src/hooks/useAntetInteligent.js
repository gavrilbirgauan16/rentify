// "Antet inteligent": afla in ce directie derulezi pagina.
//  - derulezi in JOS (citesti)            -> ascuns = true  (antetul iese din ecran, ai tot spatiul)
//  - derulezi putin in SUS (vrei meniul)  -> ascuns = false (antetul revine imediat)
//  - esti aproape de inceputul paginii    -> mereu vizibil
// derulat = true cand nu mai esti chiar sus (antetul devine mai compact, cu umbra).
import { useEffect, useState } from 'react';

const PRAG = 6;   // pixeli: miscarile mai mici (tremuratul degetului pe telefon) nu schimba nimic
const SUS = 90;   // pixeli: pana aici antetul ramane mereu vizibil

export function useAntetInteligent() {
  const [stare, setStare] = useState({ ascuns: false, derulat: false });

  useEffect(() => {
    let ultimaPozitie = window.scrollY;
    let programat = false;

    const actualizeaza = () => {
      programat = false;
      const y = window.scrollY;
      const diferenta = y - ultimaPozitie;
      if (y > SUS && Math.abs(diferenta) < PRAG) return;
      const ascuns = y > SUS && diferenta > 0;
      const derulat = y > 4;
      ultimaPozitie = y;
      // aceeasi stare -> acelasi obiect: React nu mai redeseneaza degeaba
      setStare((s) => (s.ascuns === ascuns && s.derulat === derulat ? s : { ascuns, derulat }));
    };

    // requestAnimationFrame: calculam cel mult o data pe cadru (ecranul se deseneaza de ~60 de ori pe secunda),
    // nu la fiecare eveniment "scroll" (pot fi sute). passive: browserul nu asteapta dupa noi ca sa deruleze.
    const laDerulare = () => {
      if (!programat) {
        programat = true;
        requestAnimationFrame(actualizeaza);
      }
    };
    window.addEventListener('scroll', laDerulare, { passive: true });
    return () => window.removeEventListener('scroll', laDerulare);
  }, []);

  return stare;
}
