// API-ul "Abonamentul meu" (proprietarul conectat). Aceleasi reguli ca paginile (servicii/abonamentProprietar.js).
// Din cerere se citesc DOAR planul si perioada: pretul, creditul si datele le calculeaza serverul, de fiecare data.
// Plata e SIMULATA (proiect de facultate): nu se trimit si nu se cer date de card.

const corp = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {});

// Un abonament, cum il vede proprietarul. Sumele sunt numere (lei); "stare" e calculata (platit, programat, expirat...).
const catreDtoAbonament = (a) => ({
  id: a.id,
  plan_id: a.plan_id,
  plan: a.plan_nume,
  perioada: a.perioada,
  data_inceput: a.data_inceput,
  data_sfarsit: a.data_sfarsit,
  pret: Number(a.pret), // platit cash
  credit_aplicat: Number(a.credit_aplicat), // adus dintr-un upgrade
  valoare: Number(a.pret) + Number(a.credit_aplicat),
  total_platit: a.totalPlatit,
  stare: a.stareCod(),
  reinnoire_automata: a.reinnoire_automata,
  plati: a.plati.map((p) => ({ suma: p.suma, metoda: p.metoda, stare: p.stare, data_platii: p.data_platii, referinta: p.referinta })),
});

// Un plan, cu ce include (textele de pe carduri) si limitele brute (null = nelimitat).
const catreDtoPlan = (p) => ({
  id: p.id,
  nume: p.nume,
  descriere: p.descriere || null,
  pret_lunar: Number(p.pret_lunar),
  pret_anual: Number(p.pret_anual),
  gratuit: p.esteGratuit,
  recomandat: p.recomandat,
  activ: p.activ,
  limite: {
    max_proprietati: p.limite.max_proprietati ? Number(p.limite.max_proprietati) : null,
    max_anunturi_active: p.limite.max_anunturi_active ? Number(p.limite.max_anunturi_active) : null,
  },
  caracteristici: p.caracteristici,
});

const catreLimita = (l) => ({ folosite: l.folosit, maxim: l.maxim, poate_adauga: l.poateAdauga });

// Rezultatul calculului (previzualizare sau dupa plata).
const catreDtoCalcul = (c, perioada) => ({
  tip: c.tip, // nou | upgrade (azi, cu credit) | downgrade (dupa finalul perioadei actuale)
  perioada,
  pret_intreg: c.pretIntreg,
  credit: c.credit,
  de_plata: c.dePlata,
  data_inceput: c.data_inceput,
  data_sfarsit: c.data_sfarsit,
});

// Dependency Injection (laboratorul 10): controllerul e o "fabrica" - la fiecare cerere, containerul o apeleaza
// cu serviciul de care are nevoie (primit prin parametru, nu creat aici) si primeste inapoi actiunile.
module.exports = function AbonamentApiController({ abonamentProprietar: serviciu }) {
  // GET /api/proprietar/abonament - abonamentul curent, schimbarea programata, limitele, planurile, istoricul
  async function situatie(req, res) {
    const s = await serviciu.situatie(res.locals.utilizator.id);
    res.json({
      curent: s.curent && catreDtoAbonament(s.curent),
      programat: s.programat && catreDtoAbonament(s.programat),
      limite: { proprietati: catreLimita(s.limite.proprietati), anunturi: catreLimita(s.limite.anunturi) },
      planuri: s.planuri.map(catreDtoPlan),
      istoric: s.istoric.map(catreDtoAbonament),
    });
  }

  // GET /api/proprietar/abonament/previzualizare?plan=2&perioada=lunar - cat costa si de cand (nu schimba nimic)
  async function previzualizare(req, res) {
    const s = await serviciu.pregatesteSchimbarea(res.locals.utilizator.id, req.query.plan, req.query.perioada);
    if (s.eroare) return res.status(400).json({ eroare: s.eroare });
    res.json({ plan: catreDtoPlan(s.plan), ...catreDtoCalcul(s.calcul, s.perioada) });
  }

  // POST /api/proprietar/abonament/schimba  { plan, perioada } - executa schimbarea, cu plata simulata.
  // Orice "pret" trimis in cerere e ignorat: totul se recalculeaza pe server.
  async function schimba(req, res) {
    const b = corp(req);
    const r = await serviciu.executaSchimbarea(res.locals.utilizator.id, b.plan, b.perioada);
    if (r.eroare) return res.status(400).json({ eroare: r.eroare });
    // 409 Conflict: intre previzualizare si plata, abonamentul s-a schimbat (alt tab, alt dispozitiv).
    if (r.conflict) return res.status(409).json({ eroare: 'Abonamentul tău s-a schimbat între timp. Verifică situația și încearcă din nou.' });
    res.status(201).location('/api/proprietar/abonament').json({
      mesaj: r.mesaj,
      abonament_id: r.nou.id,
      plan: catreDtoPlan(r.plan),
      ...catreDtoCalcul(r.calcul, r.nou.perioada),
      plata: r.plata && { suma: r.plata.suma, metoda: r.plata.metoda, referinta: r.plata.referinta, simulata: true },
    });
  }

  // DELETE /api/proprietar/abonament/programat - renunta la schimbarea programata (platile ei se ramburseaza)
  async function anuleazaProgramat(req, res) {
    const anulate = await serviciu.anuleazaProgramate(res.locals.utilizator.id);
    if (anulate === 0) return res.status(404).json({ eroare: 'Nu ai nicio schimbare programată.' });
    res.status(204).end();
  }

  return { situatie, previzualizare, schimba, anuleazaProgramat };
};
