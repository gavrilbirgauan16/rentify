// Controller-ul "Abonamentul meu" (zona proprietarului): planul curent, limitele folosite, planurile,
// schimbarea planului (upgrade imediat cu credit, downgrade la final de perioada) cu plata SIMULATA.
//
// Regula de aur la bani: browserul trimite doar CE plan si CE perioada vrea. Pretul, creditul si datele
// se calculeaza MEREU pe server, din baza de date (si la confirmare, si din nou la plata).
const crypto = require('crypto');
const AbonamentAccessor = require('../../src/NivelAccesDate/AbonamentAccessor');
const PlanAccessor = require('../../src/NivelAccesDate/PlanAccessor');
const AbonamentViewModel = require('../../models/AbonamentViewModel');
const PlanViewModel = require('../../models/PlanViewModel');
const { situatieProprietati, situatieAnunturi } = require('../../servicii/verificariPlan');
const { calculeazaSchimbarea } = require('../../servicii/schimbarePlan');
const D = require('../../servicii/date');
const { mesajFlash } = require('../../utils/http');

const abonamente = new AbonamentAccessor();
const planuri = new PlanAccessor();

const PAGINA = '/proprietar/abonament';
const lei = AbonamentViewModel.lei;

// GET /proprietar/abonament - planul curent, limitele, schimbarea programata, planurile si istoricul
async function index(req, res) {
  const id = req.idUtilizator;
  const azi = D.azi();
  const [curente, programate, istoric, toatePlanurile, proprietati, anunturi] = await Promise.all([
    abonamente.getCurente([id], azi),
    abonamente.getProgramate(id, azi),
    abonamente.getByUtilizator(id),
    planuri.getByRol('proprietar'),
    situatieProprietati(id),
    situatieAnunturi(id),
  ]);
  const curent = curente[0] ? AbonamentViewModel.dinEntitate(curente[0]) : null;
  // Planurile pe care le poate alege: doar cele active; planul lui apare chiar daca intre timp a fost dezactivat.
  const disponibile = toatePlanurile
    .filter((p) => p.activ || (curent && p.id === curent.plan_id))
    .map(PlanViewModel.dinEntitate);

  res.render('proprietar/abonament/index', {
    curent,
    programat: programate[0] ? AbonamentViewModel.dinEntitate(programate[0]) : null,
    planuri: disponibile,
    // "eticheta", nu "text": situatie() are deja un camp text ("1 / 1") care l-ar suprascrie.
    limite: [
      { eticheta: 'Proprietăți active', ...proprietati },
      { eticheta: 'Anunțuri publicate (active + în așteptare)', ...anunturi },
    ],
    istoric: istoric.map(AbonamentViewModel.dinEntitate),
    afiseaza: D.afiseaza,
  });
}

// Citeste planul si perioada alese (din adresa sau din formular), le verifica si calculeaza schimbarea.
// Intoarce { eroare } sau { plan, curent, calcul }.
async function pregatesteSchimbarea(req, sursa) {
  const planId = Number(sursa.plan);
  const perioada = String(sursa.perioada || '');
  const plan = Number.isInteger(planId) && planId > 0 ? await planuri.getById(planId) : null;
  // Doar planuri active, pentru proprietari (un proprietar nu poate alege un plan de chirias, oricare ar fi id-ul).
  if (!plan || !plan.activ || plan.rol.nume !== 'proprietar') return { eroare: 'Planul ales nu este disponibil.' };

  const azi = D.azi();
  const curente = await abonamente.getCurente([req.idUtilizator], azi);
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
  return { plan: PlanViewModel.dinEntitate(plan), curent, calcul, curentId: curente[0]?.id ?? null, azi };
}

// GET /proprietar/abonament/schimba?plan=2&perioada=lunar - pagina de confirmare (nu schimba nimic)
async function schimbaGet(req, res) {
  const s = await pregatesteSchimbarea(req, req.query);
  if (s.eroare) {
    mesajFlash(req, s.eroare, 'warning');
    return res.redirect(PAGINA);
  }
  res.render('proprietar/abonament/confirmare', { ...s, perioada: req.query.perioada, lei, afiseaza: D.afiseaza });
}

// POST /proprietar/abonament/schimba - executa schimbarea; totul se RECALCULEAZA aici, din baza de date
async function schimbaPost(req, res) {
  const s = await pregatesteSchimbarea(req, req.body);
  if (s.eroare) {
    mesajFlash(req, s.eroare, 'warning');
    return res.redirect(PAGINA);
  }
  const { plan, calcul } = s;
  const perioada = req.body.perioada;
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
  // Plata simulata: fara date de card. Referinta arata ca e simulata si ce credit s-a scazut.
  const referinta = `SIMULAT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
    + (calcul.credit > 0 ? ` · credit ${lei(calcul.credit)}` : '');
  const plata = calcul.dePlata > 0 ? { suma: calcul.dePlata, metoda: 'card', referinta } : null;

  const nou = await abonamente.schimbaPlanul({
    utilizatorId: req.idUtilizator, curentId: s.curentId, tip: calcul.tip, azi: s.azi, abonamentNou, plata,
  });
  if (!nou) {
    mesajFlash(req, 'Abonamentul tău s-a schimbat între timp. Verifică situația și încearcă din nou.', 'warning');
    return res.redirect(PAGINA);
  }
  const platit = plata ? ` Ai plătit ${lei(plata.suma)} (plată simulată).` : '';
  const mesaj = calcul.tip === 'downgrade'
    ? `Planul „${plan.nume}” începe pe ${D.afiseaza(calcul.data_inceput)}, după ce se termină planul actual.${platit}`
    : `Ai trecut pe planul „${plan.nume}”, începând de azi.${platit}`;
  mesajFlash(req, mesaj);
  res.redirect(PAGINA); // Post/Redirect/Get: un refresh nu mai plateste a doua oara
}

// POST /proprietar/abonament/anuleaza-programat - renunta la schimbarea programata (inca neinceputa)
async function anuleazaProgramatPost(req, res) {
  const anulate = await abonamente.anuleazaProgramate(req.idUtilizator, D.azi());
  mesajFlash(req, anulate > 0 ? 'Schimbarea programată a fost anulată. Planul actual continuă.' : 'Nu ai nicio schimbare programată.', anulate > 0 ? 'success' : 'warning');
  res.redirect(PAGINA);
}

module.exports = { index, schimbaGet, schimbaPost, anuleazaProgramatPost };
