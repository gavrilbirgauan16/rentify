// Controller-ul pentru anunturi: Index, Create, Edit (GET/POST), butoanele Activeaza / Dezactiveaza
// si imaginile anunturilor.
const AnuntAccessor = require('../src/NivelAccesDate/AnuntAccessor');
const ProprietateAccessor = require('../src/NivelAccesDate/ProprietateAccessor');
const AnuntViewModel = require('../models/AnuntViewModel');
const { stergeFisiere, MAX_IMAGINI, MAX_MB } = require('../middleware/incarcareImagini');
const { citesteId, negasit, mesajFlash, adresaInapoi } = require('../utils/http');
const UtilizatorAccessor = require('../src/NivelAccesDate/UtilizatorAccessor');
const F = require('../servicii/filtre');
const JurnalAccessor = require('../src/NivelAccesDate/JurnalAccessor');
const { noteaza } = require('../servicii/jurnal');
const { valideazaMotiv, amprentaContinut } = require('../servicii/moderare');
const emailuri = require('../servicii/emailuri');
const { trimite } = require('../servicii/email');

const anunturi = new AnuntAccessor();
const proprietati = new ProprietateAccessor();
const utilizatori = new UtilizatorAccessor();
const jurnal = new JurnalAccessor();

// Unde ne intoarcem dupa Activeaza / Dezactiveaza (lista cu filtrele ei sau pagina anuntului).
const inapoi = (req) => adresaInapoi(req, '/admin/anunturi');

// Filtrele listei de anunturi si sortarile.
const FILTRE = {
  q: { tip: 'text' },
  tip: { tip: 'enum', valori: AnuntViewModel.TIPURI },
  stare: { tip: 'enum', valori: AnuntViewModel.STARI },
  oras: { tip: 'text' },
  proprietar: { tip: 'id' },
  proprietate: { tip: 'id' },
  pret_min: { tip: 'numar' },
  pret_max: { tip: 'numar' },
  promovat: { tip: 'enum', valori: ['da', 'nu'] },
  problema: { tip: 'enum', valori: ['proprietate_inactiva', 'fara_disponibilitate'] },
  sort: { tip: 'enum', valori: ['noi', 'vechi', 'pret_asc', 'pret_desc', 'titlu'], implicit: 'noi' },
};
const SORTARI = {
  noi: [{ creat_la: 'desc' }, { id: 'desc' }],
  vechi: [{ creat_la: 'asc' }, { id: 'asc' }],
  pret_asc: [{ pret: 'asc' }, { id: 'desc' }],
  pret_desc: [{ pret: 'desc' }, { id: 'desc' }],
  titlu: [{ titlu: 'asc' }],
};
const PE_PAGINA = 20;

// Filtrele alese -> conditia pentru baza de date (Prisma "where").
function conditie(f) {
  const where = {};
  const prop = {};
  if (f.q) where.OR = F.contineText(['titlu', 'descriere', 'proprietate.denumire', 'proprietate.oras'], f.q);
  if (f.tip) where.tip = f.tip;
  if (f.stare) where.stare = f.stare;
  if (f.proprietate) where.proprietate_id = f.proprietate;
  if (f.pret_min !== '' || f.pret_max !== '') {
    where.pret = {};
    if (f.pret_min !== '') where.pret.gte = f.pret_min;
    if (f.pret_max !== '') where.pret.lte = f.pret_max;
  }
  if (f.promovat) where.promovat = f.promovat === 'da';
  if (f.oras) prop.oras = { equals: f.oras, mode: 'insensitive' };
  if (f.proprietar) prop.proprietar_id = f.proprietar;
  if (f.problema === 'proprietate_inactiva') prop.stare = 'inactiv';
  if (f.problema === 'fara_disponibilitate') where.disponibil_de_la = null;
  if (Object.keys(prop).length) where.proprietate = prop;
  return where;
}

// Pagina 404 pentru un anunt care nu exista.
const anuntNegasit = (res) => negasit(res, 'Anunțul nu există', 'Anunțul căutat nu a fost găsit.');

// Datele pentru formular: listele de selectie, inclusiv proprietatile (cheia straina).
// In lista apar doar proprietatile active; la Edit apare si proprietatea actuala, chiar daca e inactiva.
// Starile din formular: Ciorna / Activ / Inactiv, plus starea actuala la Edit (ex. "In asteptare"), ca sa poata ramane.
async function dateFormular(proprietateActuala = null, stareActuala = null) {
  const lista = await proprietati.getDisponibile();
  if (proprietateActuala && !lista.some((p) => p.id === proprietateActuala.id)) {
    lista.push(proprietateActuala);
  }
  const stari = [...AnuntViewModel.STARI_FORMULAR];
  if (stareActuala && !stari.includes(stareActuala)) stari.push(stareActuala);
  return {
    tipuri: AnuntViewModel.TIPURI,
    stari,
    monede: AnuntViewModel.MONEDE,
    eticheteTip: AnuntViewModel.ETICHETE_TIP,
    eticheteStare: AnuntViewModel.ETICHETE_STARE,
    maxImagini: MAX_IMAGINI,
    maxMb: MAX_MB,
    proprietati: lista,
  };
}

// Verificarile care tin de legatura cu proprietatea (le adauga peste erorile din model).
function verificaProprietatea(model, listaProprietati, erori) {
  if (!model.proprietate_id) return;
  const aleasa = listaProprietati.find((p) => String(p.id) === String(model.proprietate_id));
  if (!aleasa) {
    erori.proprietate_id = 'Proprietatea aleasă nu există sau este inactivă.'; // cineva a trimis un id inventat
  } else if (aleasa.stare === 'inactiv' && model.stare !== 'inactiv') {
    erori.stare = 'Proprietatea este inactivă, deci anunțul poate fi doar Inactiv.';
  }
}

// Imaginile primite de la formular, in forma pentru baza de date.
function imaginiIncarcate(req) {
  return req.files.map((f) => ({ nume: f.originalname, cale: `/uploads/anunturi/${f.filename}` }));
}

// Id-urile imaginilor bifate la "Sterge" (pot veni ca text sau ca lista).
function imaginiDeSters(req) {
  return [].concat(req.body.sterge_imagini || []).map(Number).filter((n) => Number.isInteger(n) && n > 0);
}

// Verificarile pentru imagini: eroarea de la incarcare si numarul maxim pe anunt.
function verificaImaginile(req, numarRamase, erori) {
  if (req.eroareImagini) {
    erori.imagini = req.eroareImagini;
  } else if (numarRamase + req.files.length > MAX_IMAGINI) {
    erori.imagini = `Un anunț poate avea cel mult ${MAX_IMAGINI} imagini.`;
  }
  // Daca formularul are erori, imaginile alese trebuie selectate din nou (browserul nu le pastreaza).
  if (Object.keys(erori).length > 0 && req.files.length > 0 && !erori.imagini) {
    erori.imagini = 'Formularul are erori: alege din nou imaginile.';
  }
}

// GET /admin/anunturi - lista anunturilor, cu date din anunt, proprietate, proprietar si imagini
async function index(req, res) {
  const f = F.citesteFiltre(req.query, FILTRE);
  const where = conditie(f);
  const pag = F.paginare(await anunturi.numara(where), f.pagina, PE_PAGINA);
  const [entitati, orase, proprietari, proprietateAleasa] = await Promise.all([
    anunturi.getPagina(where, SORTARI[f.sort], pag),
    proprietati.getOrase(),
    utilizatori.getByRol('proprietar'),
    f.proprietate ? proprietati.getById(f.proprietate) : null,
  ]);
  const imagini = await anunturi.getImagini(entitati.map((a) => a.id));
  const lista = entitati.map((a) => AnuntViewModel.dinEntitate(a, imagini.filter((img) => img.entitate_id === a.id)));
  res.render('admin/anunturi/index', {
    anunturi: lista,
    ...F.pentruPagina('/admin/anunturi', f, FILTRE, pag),
    orase,
    proprietari,
    proprietateAleasa,
    tipuri: AnuntViewModel.TIPURI,
    stari: AnuntViewModel.STARI,
    eticheteTip: AnuntViewModel.ETICHETE_TIP,
    eticheteStare: AnuntViewModel.ETICHETE_STARE,
  });
}

// GET /admin/anunturi/:id - pagina unui anunt (aceleasi detalii ca fereastra din lista + istoricul)
async function details(req, res) {
  const id = citesteId(req);
  const entitate = id && (await anunturi.getById(id));
  if (!entitate) return anuntNegasit(res);
  const [imagini, istoric] = await Promise.all([anunturi.getImagini([id]), jurnal.getPentru('anunt', id)]);
  res.render('admin/anunturi/details', {
    a: AnuntViewModel.dinEntitate(entitate, imagini),
    istoric,
    versiune: amprentaContinut(entitate, imagini.map((f) => f.id)), // ce varianta vede adminul acum
  });
}

// Un anunt "In asteptare" e al proprietarului: adminul nu-i schimba continutul, doar il aproba sau il respinge cu motiv.
function blocatInAsteptare(req, res, entitate) {
  if (entitate.stare !== 'in_asteptare') return false;
  mesajFlash(req, 'Anunțul așteaptă aprobarea: nu-l poți modifica. Dacă trebuie corectat, respinge-l cu motivul, iar proprietarul îl corectează.', 'warning');
  res.redirect(`/admin/anunturi/${entitate.id}`);
  return true;
}

// GET /admin/anunturi/create - formularul gol
async function createGet(req, res) {
  res.render('admin/anunturi/create', { a: new AnuntViewModel(), erori: {}, ...(await dateFormular()) });
}

// POST /admin/anunturi/create - salvarea anuntului nou, cu imaginile lui
async function createPost(req, res) {
  const model = AnuntViewModel.dinFormular(req.body);
  const date = await dateFormular();
  const erori = model.valideaza();
  verificaProprietatea(model, date.proprietati, erori);
  verificaImaginile(req, 0, erori);

  const imagini = imaginiIncarcate(req);
  if (Object.keys(erori).length > 0) {
    stergeFisiere(imagini.map((i) => i.cale)); // anuntul nu se salveaza, deci nici imaginile
    return res.status(400).render('admin/anunturi/create', { a: model, erori, ...date });
  }
  // Adminul e moderatorul: un anunt pus de el "Activ" e si aprobat.
  const deSalvat = model.catreEntitate();
  const nou = await anunturi.addEntity({ ...deSalvat, aprobat_la: deSalvat.stare === 'activ' ? new Date() : null }, imagini, res.locals.utilizator.id);
  await noteaza(res, 'creare', 'anunt', nou.id, nou.titlu);
  mesajFlash(req, `Anunțul „${nou.titlu}” a fost adăugat.`);
  res.redirect('/admin/anunturi'); // Post/Redirect/Get
}

// GET /admin/anunturi/:id/edit - formularul completat cu datele existente si imaginile actuale
async function editGet(req, res) {
  const id = citesteId(req);
  const entitate = id && (await anunturi.getById(id));
  if (!entitate) return anuntNegasit(res);
  if (blocatInAsteptare(req, res, entitate)) return;
  const model = AnuntViewModel.dinEntitate(entitate, await anunturi.getImagini([id]));
  res.render('admin/anunturi/edit', { a: model, erori: {}, ...(await dateFormular(entitate.proprietate, entitate.stare)) });
}

// POST /admin/anunturi/:id/edit - salvarea modificarilor (date + imagini noi + imagini sterse)
async function editPost(req, res) {
  const id = citesteId(req);
  const entitate = id && (await anunturi.getById(id));
  if (!entitate) {
    stergeFisiere(imaginiIncarcate(req).map((i) => i.cale));
    return anuntNegasit(res);
  }
  if (entitate.stare === 'in_asteptare') {
    stergeFisiere(imaginiIncarcate(req).map((i) => i.cale));
    if (blocatInAsteptare(req, res, entitate)) return;
  }

  const imaginiActuale = await anunturi.getImagini([id]);
  const deSters = imaginiDeSters(req);
  const model = AnuntViewModel.dinFormular(req.body);
  model.id = id;
  model.imagini = AnuntViewModel.dinEntitate(entitate, imaginiActuale).imagini;

  const date = await dateFormular(entitate.proprietate, entitate.stare);
  const erori = model.valideaza(entitate.stare);
  verificaProprietatea(model, date.proprietati, erori);
  const ramase = imaginiActuale.filter((f) => !deSters.includes(f.id)).length;
  verificaImaginile(req, ramase, erori);

  const imaginiNoi = imaginiIncarcate(req);
  if (Object.keys(erori).length > 0) {
    stergeFisiere(imaginiNoi.map((i) => i.cale));
    return res.status(400).render('admin/anunturi/edit', { a: model, erori, ...date });
  }
  // Adminul pune "Activ" = aproba (un anunt deja aprobat isi pastreaza data aprobarii).
  const deSalvat = model.catreEntitate();
  deSalvat.aprobat_la = deSalvat.stare === 'activ' ? (entitate.aprobat_la ?? new Date()) : entitate.aprobat_la;
  const { caiSterse } = await anunturi.updateEntity(id, deSalvat, imaginiNoi, deSters, res.locals.utilizator.id);
  stergeFisiere(caiSterse); // imaginile sterse dispar si de pe disc
  await noteaza(res, 'modificare', 'anunt', id, model.titlu);
  mesajFlash(req, `Anunțul „${model.titlu}” a fost modificat.`);
  res.redirect('/admin/anunturi');
}

// POST /admin/anunturi/:id/activeaza - butonul Activeaza (doar daca proprietatea lui e activa)
async function activeaza(req, res) {
  const id = citesteId(req);
  const entitate = id && (await anunturi.getById(id));
  if (!entitate) return anuntNegasit(res);
  // Un anunt in asteptare se aproba doar de pe pagina lui (unde adminul il vede), nu dintr-un buton din lista.
  if (entitate.stare === 'in_asteptare') {
    mesajFlash(req, 'Anunțul așteaptă aprobarea: deschide-l, verifică-l și apasă „Aprobă”.', 'warning');
    return res.redirect(`/admin/anunturi/${id}`);
  }
  if (entitate.proprietate.stare === 'inactiv') {
    mesajFlash(req, `Anunțul nu poate fi activat: proprietatea „${entitate.proprietate.denumire}” este inactivă. Activează întâi proprietatea.`, 'warning');
    return res.redirect(inapoi(req));
  }
  await anunturi.schimbaStare(id, 'activ', { aprobat_la: entitate.aprobat_la ?? new Date() }); // adminul activeaza = aproba
  await noteaza(res, 'activare', 'anunt', id, entitate.titlu);
  mesajFlash(req, `Anunțul „${entitate.titlu}” a fost activat.`);
  res.redirect(inapoi(req));
}

// POST /admin/anunturi/:id/dezactiveaza - butonul Dezactiveaza
async function dezactiveaza(req, res) {
  const id = citesteId(req);
  const entitate = id && (await anunturi.getById(id));
  if (!entitate) return anuntNegasit(res);
  await anunturi.schimbaStare(id, 'inactiv');
  await noteaza(res, 'dezactivare', 'anunt', id, entitate.titlu);
  mesajFlash(req, `Anunțul „${entitate.titlu}” a fost dezactivat.`);
  res.redirect(inapoi(req));
}

// ===== Moderarea =====

// Trimite proprietarului emailul despre aprobare / respingere. Un email care nu pleaca nu opreste actiunea.
async function anuntaProprietarul(entitate, email) {
  const u = entitate.proprietate?.utilizator;
  if (!u?.email) return;
  await trimite({ catre: u.email, subiect: email.subiect, text: email.text, html: email.html });
}

// POST /admin/anunturi/:id/aproba - anuntul in asteptare devine activ (public)
async function aproba(req, res) {
  const id = citesteId(req);
  const entitate = id && (await anunturi.getById(id));
  if (!entitate) return anuntNegasit(res);
  if (entitate.proprietate.stare === 'inactiv') {
    mesajFlash(req, `Anunțul nu poate fi aprobat: proprietatea „${entitate.proprietate.denumire}” este inactivă.`, 'warning');
    return res.redirect(inapoi(req));
  }
  // Blocare optimista: adminul aproba exact varianta pe care a vazut-o. Daca proprietarul a modificat-o intre timp,
  // amprenta trimisa de formular nu mai e cea de acum -> nu aprobam, il trimitem sa o vada din nou.
  const imagini = await anunturi.getImagini([id]);
  if (String(req.body.versiune || '') !== amprentaContinut(entitate, imagini.map((f) => f.id))) {
    mesajFlash(req, 'Proprietarul a modificat anunțul între timp. Verifică varianta nouă și apoi aprobă-l.', 'warning');
    return res.redirect(`/admin/anunturi/${id}`);
  }
  // Conditia "in asteptare" e verificata chiar in baza de date (vezi accesorul): doi admini deodata nu-l aproba de doua ori.
  if (!(await anunturi.aproba(id))) {
    mesajFlash(req, 'Anunțul nu mai așteaptă aprobarea (poate a fost deja aprobat sau retras de proprietar).', 'warning');
    return res.redirect(inapoi(req));
  }
  await noteaza(res, 'aprobare', 'anunt', id, entitate.titlu);
  await anuntaProprietarul(entitate, emailuri.anuntAprobat(entitate.proprietate.utilizator, entitate.titlu));
  mesajFlash(req, `Anunțul „${entitate.titlu}” a fost aprobat și apare pe site. Proprietarul a fost anunțat pe email.`);
  res.redirect(inapoi(req));
}

// POST /admin/anunturi/:id/respinge - cu motiv obligatoriu (il vede proprietarul, ca sa stie ce sa corecteze)
async function respinge(req, res) {
  const id = citesteId(req);
  const entitate = id && (await anunturi.getById(id));
  if (!entitate) return anuntNegasit(res);
  const { motiv, eroare } = valideazaMotiv(req.body.motiv);
  if (eroare) {
    mesajFlash(req, eroare, 'warning');
    return res.redirect(`/admin/anunturi/${id}`);
  }
  if (!(await anunturi.respinge(id, motiv))) {
    mesajFlash(req, 'Doar un anunț în așteptare sau activ poate fi respins.', 'warning');
    return res.redirect(`/admin/anunturi/${id}`);
  }
  await noteaza(res, 'respingere', 'anunt', id, `${entitate.titlu} – motiv: ${motiv}`);
  await anuntaProprietarul(entitate, emailuri.anuntRespins(entitate.proprietate.utilizator, entitate.titlu, motiv));
  mesajFlash(req, `Anunțul „${entitate.titlu}” a fost respins. Proprietarul a primit motivul pe email.`);
  res.redirect(`/admin/anunturi/${id}`);
}

module.exports = {
  index, details, createGet, createPost, editGet, editPost, activeaza, dezactiveaza, aproba, respinge,
  // Folosite si de API si de zona proprietarului (aceleasi reguli, scrise o singura data).
  verificaProprietatea, imaginiIncarcate, imaginiDeSters, verificaImaginile,
};