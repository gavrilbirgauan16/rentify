// Controller-ul "Abonamentul meu" (zona proprietarului). Deocamdata doar AFISEAZA:
// planul curent, perioada, cat a folosit din limite, planurile disponibile si istoricul abonamentelor.
// Schimbarea planului si plata (simulata) se adauga separat, pe ramura "abonament".
const AbonamentAccessor = require('../../src/NivelAccesDate/AbonamentAccessor');
const PlanAccessor = require('../../src/NivelAccesDate/PlanAccessor');
const AbonamentViewModel = require('../../models/AbonamentViewModel');
const PlanViewModel = require('../../models/PlanViewModel');
const { situatieProprietati, situatieAnunturi } = require('../../servicii/verificariPlan');
const { azi } = require('../../servicii/date');

const abonamente = new AbonamentAccessor();
const planuri = new PlanAccessor();

// GET /proprietar/abonament
async function index(req, res) {
  const id = req.idUtilizator;
  const [curente, istoric, toatePlanurile, proprietati, anunturi] = await Promise.all([
    abonamente.getCurente([id], azi()),
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
    planuri: disponibile,
    // "eticheta", nu "text": situatie() are deja un camp text ("1 / 1") care l-ar suprascrie.
    limite: [
      { eticheta: 'Proprietăți active', ...proprietati },
      { eticheta: 'Anunțuri active', ...anunturi },
    ],
    istoric: istoric.map(AbonamentViewModel.dinEntitate),
  });
}

module.exports = { index };
