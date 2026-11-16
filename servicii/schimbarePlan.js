// Calculul schimbarii planului de abonament (functie PURA: nu citeste si nu scrie in baza de date,
// deci se poate testa cu orice caz). Toti banii se calculeaza in bani (intregi), nu cu zecimale.
//
// Reguli:
//  1. Fara abonament in curs            -> plan nou, de azi, pret intreg.
//  2. Plan mai scump (sau acelasi plan,  -> UPGRADE: incepe azi; ce s-a platit si nu s-a folosit
//     de pe lunar pe anual)                 din abonamentul vechi se scade din pret (calcul proportional).
//  3. Plan mai ieftin (sau acelasi plan, -> DOWNGRADE: incepe a doua zi dupa ce se termina cel actual,
//     de pe anual pe lunar)                 fara credit (perioada platita se foloseste pana la capat).
//  4. Acelasi plan, aceeasi perioada     -> nimic de schimbat.
//  5. La upgrade nu se trece de pe anual pe lunar: creditul anual ar fi mai mare decat pretul lunar si s-ar pierde.
const D = require('./date');

const bani = (v) => Math.round(Number(v) * 100);
const lei = (b) => b / 100;

// Pretul unui plan pentru o perioada ('lunar' / 'anual'), in bani.
const pretPlan = (plan, perioada) => bani(perioada === 'anual' ? plan.pret_anual : plan.pret_lunar);

// Cat valoreaza zilele nefolosite din abonamentul curent, daca se opreste AZI (azi intra in planul nou).
// Valoarea abonamentului = ce s-a platit efectiv cash (cel mult pretul) + creditul adus la randul lui dintr-un
// upgrade anterior. Fara creditul adus, la doua upgrade-uri la rand primul credit s-ar pierde.
// Un abonament neplatit da credit doar din creditul adus.
function creditRamas(curent, azi) {
  const zileTotale = D.zileIntre(curent.data_inceput, curent.data_sfarsit) + 1;
  const zileRamase = Math.max(0, Math.min(zileTotale, D.zileIntre(azi, curent.data_sfarsit) + 1));
  const valoare = Math.min(bani(curent.platit), bani(curent.pret)) + bani(curent.credit_aplicat ?? 0);
  return Math.floor((valoare * zileRamase) / zileTotale); // rotunjim in jos: nu dam mai mult decat a platit
}

// Este planul nou un "pas in sus"? Comparam planurile dupa pretul lunar; la acelasi plan, dupa perioada.
function esteUpgrade(curent, planNou, perioadaNoua) {
  if (curent.plan_id === planNou.id) return curent.perioada === 'lunar' && perioadaNoua === 'anual';
  return bani(planNou.pret_lunar) > bani(curent.plan_pret_lunar);
}

// curent = abonamentul in curs sau null:
//   { plan_id, plan_pret_lunar, perioada, pret, platit, credit_aplicat, data_inceput, data_sfarsit } (datele ca 'AAAA-LL-ZZ')
// planNou = { id, nume, pret_lunar, pret_anual }; perioada = 'lunar' | 'anual'; azi = 'AAAA-LL-ZZ'
// Intoarce { tip, eroare, pretIntreg, credit, dePlata, data_inceput, data_sfarsit } (sumele in lei).
function calculeazaSchimbarea({ curent, planNou, perioada, azi }) {
  const pretIntreg = pretPlan(planNou, perioada);
  const rezultat = (tip, inceput, credit = 0, eroare = null) => ({
    tip,
    eroare,
    pretIntreg: lei(pretIntreg),
    credit: lei(credit),
    dePlata: lei(Math.max(0, pretIntreg - credit)),
    data_inceput: inceput,
    data_sfarsit: inceput ? D.sfarsitPerioada(inceput, perioada) : null,
  });

  if (!['lunar', 'anual'].includes(perioada)) return rezultat('invalid', null, 0, 'Alege perioada: lunar sau anual.');
  if (!curent) return rezultat('nou', azi);
  if (curent.plan_id === planNou.id && curent.perioada === perioada) {
    return rezultat('acelasi', null, 0, 'Ai deja acest plan, cu aceeași perioadă de plată.');
  }

  if (esteUpgrade(curent, planNou, perioada)) {
    if (curent.perioada === 'anual' && perioada === 'lunar' && bani(curent.pret) > 0) {
      return rezultat('upgrade', null, 0, 'Ai un abonament anual: ca să nu pierzi din banii plătiți, alege planul nou tot cu plată anuală.');
    }
    return rezultat('upgrade', azi, Math.min(creditRamas(curent, azi), pretIntreg));
  }
  return rezultat('downgrade', D.adunaZile(curent.data_sfarsit, 1));
}

module.exports = { calculeazaSchimbarea, creditRamas };
