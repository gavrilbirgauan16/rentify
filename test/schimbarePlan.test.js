// Teste pentru schimbarea planului: plan nou, upgrade cu credit proportional, downgrade la final de perioada.
// Fiecare caz e un exemplu calculat de mana.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculeazaSchimbarea, creditRamas } = require('../servicii/schimbarePlan');

const GRATUIT = { id: 6, nume: 'Gratuit', pret_lunar: 0, pret_anual: 0 };
const BASIC = { id: 1, nume: 'Basic', pret_lunar: 250, pret_anual: 2500 };
const STANDARD = { id: 2, nume: 'Standard', pret_lunar: 450, pret_anual: 4500 };

// Abonamentul curent, din planul dat. Implicit: lunar, 1-30 noiembrie, platit integral.
const abonament = (plan, date = {}) => {
  const perioada = date.perioada ?? 'lunar';
  const pret = perioada === 'anual' ? plan.pret_anual : plan.pret_lunar;
  return {
    plan_id: plan.id, plan_pret_lunar: plan.pret_lunar, perioada, pret, platit: pret,
    data_inceput: '2026-11-01', data_sfarsit: '2026-11-30', ...date,
  };
};

test('fara abonament: plan nou de azi, pret intreg', () => {
  const r = calculeazaSchimbarea({ curent: null, planNou: BASIC, perioada: 'lunar', azi: '2026-11-16' });
  assert.equal(r.tip, 'nou');
  assert.equal(r.dePlata, 250);
  assert.equal(r.data_inceput, '2026-11-16');
  assert.equal(r.data_sfarsit, '2026-12-15');
});

test('de pe Gratuit pe Basic: upgrade de azi, fara credit (nu s-a platit nimic)', () => {
  const curent = abonament(GRATUIT, { perioada: 'anual', data_sfarsit: '2027-10-31' });
  const r = calculeazaSchimbarea({ curent, planNou: BASIC, perioada: 'lunar', azi: '2026-11-16' });
  assert.equal(r.tip, 'upgrade');
  assert.equal(r.eroare, null); // anual -> lunar e permis cand planul vechi era gratuit
  assert.equal(r.credit, 0);
  assert.equal(r.dePlata, 250);
  assert.equal(r.data_inceput, '2026-11-16');
});

test('Basic -> Standard dupa 10 zile: credit pentru cele 20 de zile ramase', () => {
  // 250 lei pe 30 de zile; raman 11-30 noiembrie = 20 de zile -> 250 * 20 / 30 = 166,666... -> 166,66 (in jos)
  const r = calculeazaSchimbarea({ curent: abonament(BASIC), planNou: STANDARD, perioada: 'lunar', azi: '2026-11-11' });
  assert.equal(r.tip, 'upgrade');
  assert.equal(r.credit, 166.66);
  assert.equal(r.dePlata, 283.34); // 450 - 166,66
  assert.equal(r.data_inceput, '2026-11-11');
  assert.equal(r.data_sfarsit, '2026-12-10');
});

test('creditul: azi intra in planul nou; in ultima zi mai ramane o zi', () => {
  assert.equal(creditRamas(abonament(BASIC), '2026-11-01'), 25000); // din prima zi: tot creditul
  assert.equal(creditRamas(abonament(BASIC), '2026-11-30'), 833); // o zi din 30: 8,33 lei
  assert.equal(creditRamas(abonament(BASIC), '2026-12-05'), 0); // deja terminat
});

test('un abonament neplatit (sau platit pe jumatate) da credit doar din ce s-a platit', () => {
  assert.equal(creditRamas(abonament(BASIC, { platit: 0 }), '2026-11-11'), 0);
  assert.equal(creditRamas(abonament(BASIC, { platit: 125 }), '2026-11-16'), 6250); // 125 lei * 15/30
});

test('acelasi plan de pe lunar pe anual: upgrade de azi, cu credit', () => {
  const r = calculeazaSchimbarea({ curent: abonament(BASIC), planNou: BASIC, perioada: 'anual', azi: '2026-11-16' });
  assert.equal(r.tip, 'upgrade');
  assert.equal(r.credit, 125); // 250 * 15/30
  assert.equal(r.dePlata, 2375);
  assert.equal(r.data_sfarsit, '2027-11-15');
});

test('Standard -> Basic: downgrade de la sfarsitul perioadei, fara credit', () => {
  const r = calculeazaSchimbarea({ curent: abonament(STANDARD), planNou: BASIC, perioada: 'lunar', azi: '2026-11-11' });
  assert.equal(r.tip, 'downgrade');
  assert.equal(r.credit, 0);
  assert.equal(r.dePlata, 250);
  assert.equal(r.data_inceput, '2026-12-01');
  assert.equal(r.data_sfarsit, '2026-12-31');
});

test('de pe un plan platit pe Gratuit: downgrade la final, nimic de plata', () => {
  const r = calculeazaSchimbarea({ curent: abonament(BASIC), planNou: GRATUIT, perioada: 'anual', azi: '2026-11-11' });
  assert.equal(r.tip, 'downgrade');
  assert.equal(r.dePlata, 0);
  assert.equal(r.data_inceput, '2026-12-01');
});

test('acelasi plan de pe anual pe lunar: downgrade la final', () => {
  const curent = abonament(BASIC, { perioada: 'anual', data_sfarsit: '2027-10-31' });
  const r = calculeazaSchimbarea({ curent, planNou: BASIC, perioada: 'lunar', azi: '2026-11-11' });
  assert.equal(r.tip, 'downgrade');
  assert.equal(r.data_inceput, '2027-11-01');
});

test('upgrade de pe un abonament anual platit pe unul lunar: refuzat (s-ar pierde bani)', () => {
  const curent = abonament(BASIC, { perioada: 'anual', data_sfarsit: '2027-10-31' });
  const r = calculeazaSchimbarea({ curent, planNou: STANDARD, perioada: 'lunar', azi: '2026-11-11' });
  assert.equal(r.tip, 'upgrade');
  assert.match(r.eroare, /alege planul nou tot cu plată anuală/);
  assert.equal(r.data_inceput, null);
  // ...dar pe anual merge, iar creditul anual se scade din pretul anual
  const anual = calculeazaSchimbarea({ curent, planNou: STANDARD, perioada: 'anual', azi: '2026-11-11' });
  assert.equal(anual.eroare, null);
  assert.ok(anual.credit > 0 && anual.dePlata < 4500);
});

test('acelasi plan si aceeasi perioada: nimic de schimbat; perioada inventata: refuzata', () => {
  assert.ok(calculeazaSchimbarea({ curent: abonament(BASIC), planNou: BASIC, perioada: 'lunar', azi: '2026-11-11' }).eroare);
  assert.ok(calculeazaSchimbarea({ curent: null, planNou: BASIC, perioada: 'saptamanal', azi: '2026-11-11' }).eroare);
});

// Bug gasit la testarea in browser (16 nov): la doua upgrade-uri la rand se pierdea creditul primului.
// Toate in aceeasi zi: totalul platit cash trebuie sa fie exact pretul planului final.
test('lant de upgrade-uri in aceeasi zi: nu se pierde niciun ban', () => {
  const azi = '2026-11-16';
  const sf = (inceput, perioada) => (perioada === 'anual' ? '2027-11-15' : '2026-12-15');
  let curent = abonament(GRATUIT, { perioada: 'anual', data_inceput: azi, data_sfarsit: '2027-11-15' });
  let totalCash = 0;
  for (const [plan, perioada] of [[BASIC, 'lunar'], [BASIC, 'anual'], [STANDARD, 'anual']]) {
    const r = calculeazaSchimbarea({ curent, planNou: plan, perioada, azi });
    assert.equal(r.eroare, null);
    totalCash += r.dePlata;
    // abonamentul nou, cum il salveaza aplicatia: pret = cash, credit_aplicat = creditul adus
    curent = {
      plan_id: plan.id, plan_pret_lunar: plan.pret_lunar, perioada, pret: r.dePlata, platit: r.dePlata,
      credit_aplicat: r.credit, data_inceput: azi, data_sfarsit: sf(azi, perioada),
    };
  }
  assert.equal(totalCash, 4500); // 250 + 2250 + 2000 = pretul Standard anual (inainte de reparatie: 4750)
});

test('creditul adus intra in valoarea abonamentului (si cand cash-ul e 0)', () => {
  const curent = abonament(BASIC, { pret: 0, platit: 0, credit_aplicat: 250 }); // platit integral din credit
  assert.equal(creditRamas(curent, '2026-11-16'), 12500); // 250 * 15/30
});

test('suma de plata nu e niciodata negativa, iar creditul nu depaseste pretul planului nou', () => {
  const curent = abonament(STANDARD, { perioada: 'anual', data_inceput: '2026-11-10', data_sfarsit: '2027-11-09' });
  const PREMIUM = { id: 3, nume: 'Premium', pret_lunar: 600, pret_anual: 6000 };
  const r = calculeazaSchimbarea({ curent, planNou: PREMIUM, perioada: 'anual', azi: '2026-11-11' });
  assert.ok(r.credit <= r.pretIntreg);
  assert.ok(r.dePlata >= 0);
});
