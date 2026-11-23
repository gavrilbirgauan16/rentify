// Regulile pentru "Abonamentul meu" (proprietarul), scrise O SINGURA DATA si folosite de pagini si de API.
// Regula de aur la bani: din cerere se citesc DOAR planul si perioada. Pretul, creditul si datele se calculeaza
// MEREU pe server, din baza de date (si la previzualizare, si din nou la plata) - servicii/schimbarePlan.js.
// Dependintele (accesorii, verificarile de plan) vin prin constructor, de la containerul DI.
const crypto = require('crypto');
const AbonamentViewModel = require('../models/AbonamentViewModel');
const PlanViewModel = require('../models/PlanViewModel');
const { calculeazaSchimbarea } = require('./schimbarePlan');
const D = require('./date');

const lei = AbonamentViewModel.lei;

class AbonamentProprietar {
  constructor({ abonamentAccessor, planAccessor, verificariPlan }) {
    this.abonamente = abonamentAccessor;
    this.planuri = planAccessor;
    this.verificariPlan = verificariPlan;
  }

  // Situatia completa: abonamentul curent, schimbarea programata, limitele folosite, planurile si istoricul.
  async situatie(proprietarId) {
    const azi = D.azi();
    const [curente, programate, istoric, toatePlanurile, proprietati, anunturi] = await Promise.all([
      this.abonamente.getCurente([proprietarId], azi),
      this.abonamente.getProgramate(proprietarId, azi),
      this.abonamente.getByUtilizator(proprietarId),
      this.planuri.getByRol('proprietar'),
      this.verificariPlan.situatieProprietati(proprietarId),
      this.verificariPlan.situatieAnunturi(proprietarId),
    ]);
    const curent = curente[0] ? AbonamentViewModel.dinEntitate(curente[0]) : null;
    return {
      curent,
      programat: programate[0] ? AbonamentViewModel.dinEntitate(programate[0]) : null,
      // Planurile pe care le poate alege: doar cele active; planul lui apare chiar daca intre timp a fost dezactivat.
      planuri: toatePlanurile.filter((p) => p.activ || (curent && p.id === curent.plan_id)).map(PlanViewModel.dinEntitate),
      limite: { proprietati, anunturi },
      istoric: istoric.map(AbonamentViewModel.dinEntitate),
    };
  }

  // Verifica planul si perioada alese si calculeaza schimbarea (nu schimba nimic).
  // Intoarce { eroare } sau { plan, curent, calcul, perioada, curentId, azi }.
  async pregatesteSchimbarea(proprietarId, planIdBrut, perioadaBruta) {
    const planId = Number(planIdBrut);
    const perioada = String(perioadaBruta || '');
    const plan = Number.isInteger(planId) && planId > 0 ? await this.planuri.getById(planId) : null;
    // Doar planuri active, pentru proprietari (un proprietar nu poate alege un plan de chirias, oricare ar fi id-ul).
    if (!plan || !plan.activ || plan.rol.nume !== 'proprietar') return { eroare: 'Planul ales nu este disponibil.' };

    const azi = D.azi();
    const curente = await this.abonamente.getCurente([proprietarId], azi);
    const curent = curente[0] ? AbonamentViewModel.dinEntitate(curente[0]) : null;
    const calcul = calculeazaSchimbarea({
      curent: curent && {
        plan_id: curent.plan_id,
        plan_pret_lunar: curente[0].plan_abonament.pret_lunar,
        perioada: curent.perioada,
        pret: curent.pret,
        platit: curent.totalPlatit,
        credit_aplicat: curent.credit_aplicat,
        data_inceput: curent.data_inceput,
        data_sfarsit: curent.data_sfarsit,
      },
      planNou: plan,
      perioada,
      azi,
    });
    if (calcul.eroare) return { eroare: calcul.eroare };
    return { plan: PlanViewModel.dinEntitate(plan), curent, calcul, perioada, curentId: curente[0]?.id ?? null, azi };
  }

  // Executa schimbarea, cu plata SIMULATA (fara date de card). Totul se recalculeaza aici.
  // Intoarce { eroare } | { conflict: true } (abonamentul s-a schimbat intre timp) | { nou, plan, calcul, plata, mesaj }.
  async executaSchimbarea(proprietarId, planIdBrut, perioadaBruta) {
    const s = await this.pregatesteSchimbarea(proprietarId, planIdBrut, perioadaBruta);
    if (s.eroare) return { eroare: s.eroare };
    const { plan, calcul, perioada } = s;
    const abonamentNou = {
      plan_id: plan.id,
      perioada,
      pret: calcul.dePlata, // ce se plateste cash, dupa credit
      credit_aplicat: calcul.credit, // creditul adus; valoarea abonamentului = pret + credit_aplicat
      data_inceput: D.catreDate(calcul.data_inceput),
      data_sfarsit: D.catreDate(calcul.data_sfarsit),
      reinnoire_automata: true,
      stare: 'activ',
    };
    // Referinta arata ca plata e simulata si ce credit s-a scazut.
    const referinta = `SIMULAT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
      + (calcul.credit > 0 ? ` · credit ${lei(calcul.credit)}` : '');
    const plata = calcul.dePlata > 0 ? { suma: calcul.dePlata, metoda: 'card', referinta } : null;

    const nou = await this.abonamente.schimbaPlanul({
      utilizatorId: proprietarId, curentId: s.curentId, tip: calcul.tip, azi: s.azi, abonamentNou, plata,
    });
    if (!nou) return { conflict: true };

    const platit = plata ? ` Ai plătit ${lei(plata.suma)} (plată simulată).` : '';
    const mesaj = calcul.tip === 'downgrade'
      ? `Planul „${plan.nume}” începe pe ${D.afiseaza(calcul.data_inceput)}, după ce se termină planul actual.${platit}`
      : `Ai trecut pe planul „${plan.nume}”, începând de azi.${platit}`;
    return { nou, plan, calcul, plata, mesaj };
  }

  // Renunta la schimbarea programata (inca neinceputa); platile ei se marcheaza rambursate. Intoarce cate s-au anulat.
  anuleazaProgramate(proprietarId) {
    return this.abonamente.anuleazaProgramate(proprietarId, D.azi());
  }
}

module.exports = AbonamentProprietar;
