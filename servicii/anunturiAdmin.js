// Anunturile in zona adminului: lista cu filtre, detalii, adaugare / modificare cu imagini, activare / dezactivare,
// moderarea (aproba / respinge) si restaurarea celor sterse logic.
// Mutat aici din AnunturiController (laboratorul 10). Dependintele vin prin constructor, de la containerul DI.
// Reguli:
//   - adminul e moderatorul: un anunt pus de el "Activ" e si aprobat;
//   - un anunt "In asteptare" e al proprietarului: adminul nu-i schimba continutul, doar il aproba sau il respinge;
//   - la aprobare, blocare optimista: adminul aproba exact varianta pe care a vazut-o (amprenta continutului).
// Fiecare metoda intoarce un rezultat; controllerul decide cum il arata (pagina, mesaj, redirectionare).
const AnuntViewModel = require('../models/AnuntViewModel');
const { stergeFisiere, eroareImagini } = require('../middleware/incarcareImagini');
const { valideazaMotiv, amprentaContinut } = require('./moderare');
const emailuri = require('./emailuri');
const { trimite } = require('./email');
const F = require('./filtre');

const { verificaProprietatea } = AnuntViewModel;

// Sortarile listei (cheile apar in adresa: ?sort=pret_asc).
const SORTARI = {
  noi: [{ creat_la: 'desc' }, { id: 'desc' }],
  vechi: [{ creat_la: 'asc' }, { id: 'asc' }],
  pret_asc: [{ pret: 'asc' }, { id: 'desc' }],
  pret_desc: [{ pret: 'desc' }, { id: 'desc' }],
  titlu: [{ titlu: 'asc' }],
};

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

// Trimite proprietarului emailul despre aprobare / respingere. Un email care nu pleaca nu opreste actiunea.
async function anuntaProprietarul(entitate, email) {
  const u = entitate.proprietate?.utilizator;
  if (!u?.email) return;
  await trimite({ catre: u.email, subiect: email.subiect, text: email.text, html: email.html });
}

class AnunturiAdmin {
  constructor({ anuntAccessor, proprietateAccessor, utilizatorAccessor, jurnal }) {
    this.anunturi = anuntAccessor;
    this.proprietati = proprietateAccessor;
    this.utilizatori = utilizatorAccessor;
    this.jurnal = jurnal;
  }

  // O pagina din lista filtrata (cu pozele) + listele pentru filtre. Implicit lista NU contine anunturile sterse;
  // f.sterse === 'da' le arata DOAR pe cele sterse (de restaurat).
  async lista(f, pePagina) {
    const where = conditie(f);
    const sterse = { sterse: f.sterse === 'da' };
    const pag = F.paginare(await this.anunturi.numara(where, sterse), f.pagina, pePagina);
    const [entitati, orase, proprietari, proprietateAleasa] = await Promise.all([
      this.anunturi.getPagina(where, SORTARI[f.sort], pag, sterse),
      this.proprietati.getOrase(),
      this.utilizatori.getByRol('proprietar'),
      f.proprietate ? this.proprietati.getById(f.proprietate) : null,
    ]);
    const imagini = await this.anunturi.getImagini(entitati.map((a) => a.id));
    const randuri = entitati.map((a) => AnuntViewModel.dinEntitate(a, imagini.filter((img) => img.entitate_id === a.id)));
    return { randuri, pag, orase, proprietari, proprietateAleasa };
  }

  // Pagina unui anunt: modelul, istoricul din jurnal si "versiunea" (amprenta) pe care o vede adminul acum.
  async detalii(id) {
    const entitate = await this.anunturi.getById(id);
    if (!entitate) return null;
    const [imagini, istoric] = await Promise.all([this.anunturi.getImagini([id]), this.jurnal.pentru('anunt', id)]);
    return {
      a: AnuntViewModel.dinEntitate(entitate, imagini),
      istoric,
      versiune: amprentaContinut(entitate, imagini.map((f) => f.id)),
    };
  }

  // Proprietatile din formular: doar cele active; la modificare apare si proprietatea actuala, chiar daca e inactiva.
  async proprietatiPentruFormular(proprietateActuala = null) {
    const lista = await this.proprietati.getDisponibile();
    if (proprietateActuala && !lista.some((p) => p.id === proprietateActuala.id)) lista.push(proprietateActuala);
    return lista;
  }

  // Formularul de modificare. Intoarce { negasit } | { inAsteptare } | { model, lista, stareActuala }.
  async pentruModificare(id) {
    const entitate = await this.anunturi.getById(id);
    if (!entitate) return { negasit: true };
    if (entitate.stare === 'in_asteptare') return { inAsteptare: true };
    return {
      model: AnuntViewModel.dinEntitate(entitate, await this.anunturi.getImagini([id])),
      lista: await this.proprietatiPentruFormular(entitate.proprietate),
      stareActuala: entitate.stare,
    };
  }

  // Anunt nou. imagini = { noi: [{ nume, cale }], eroare } (pozele deja salvate pe disc de middleware).
  // Intoarce { model, erori, lista } | { anunt }. Daca anuntul nu se salveaza, pozele noi se sterg de pe disc.
  async adauga(date, imagini, admin) {
    const noi = imagini.noi || [];
    const model = AnuntViewModel.dinFormular(date);
    const lista = await this.proprietatiPentruFormular();
    const erori = model.valideaza();
    verificaProprietatea(model, lista, erori);
    const eImg = eroareImagini({ eroareIncarcare: imagini.eroare, numarNoi: noi.length, numarRamase: 0, alteErori: Object.keys(erori).length > 0 });
    if (eImg) erori.imagini = eImg;
    if (Object.keys(erori).length > 0) {
      stergeFisiere(noi.map((i) => i.cale));
      return { model, erori, lista };
    }
    const deSalvat = model.catreEntitate();
    const anunt = await this.anunturi.addEntity({ ...deSalvat, aprobat_la: deSalvat.stare === 'activ' ? new Date() : null }, noi, admin.id);
    await this.jurnal.noteaza(admin, 'creare', 'anunt', anunt.id, anunt.titlu);
    return { anunt };
  }

  // Modificare (date + imagini noi + imagini sterse). imagini = { noi, deSters: [id], eroare }.
  // Intoarce { negasit } | { inAsteptare } | { model, erori, lista, stareActuala } | { model }.
  async modifica(id, date, imagini, admin) {
    const noi = imagini.noi || [];
    const renunta = (rezultat) => { stergeFisiere(noi.map((i) => i.cale)); return rezultat; };

    const entitate = await this.anunturi.getById(id);
    if (!entitate) return renunta({ negasit: true });
    if (entitate.stare === 'in_asteptare') return renunta({ inAsteptare: true });

    const actuale = await this.anunturi.getImagini([id]);
    const deSters = imagini.deSters || [];
    const model = AnuntViewModel.dinFormular(date);
    model.id = id;
    model.imagini = AnuntViewModel.dinEntitate(entitate, actuale).imagini;

    const lista = await this.proprietatiPentruFormular(entitate.proprietate);
    const erori = model.valideaza(entitate.stare);
    verificaProprietatea(model, lista, erori);
    const ramase = actuale.filter((f) => !deSters.includes(f.id)).length;
    const eImg = eroareImagini({ eroareIncarcare: imagini.eroare, numarNoi: noi.length, numarRamase: ramase, alteErori: Object.keys(erori).length > 0 });
    if (eImg) erori.imagini = eImg;
    if (Object.keys(erori).length > 0) return renunta({ model, erori, lista, stareActuala: entitate.stare });

    // Adminul pune "Activ" = aproba (un anunt deja aprobat isi pastreaza data aprobarii).
    const deSalvat = model.catreEntitate();
    deSalvat.aprobat_la = deSalvat.stare === 'activ' ? (entitate.aprobat_la ?? new Date()) : entitate.aprobat_la;
    const { caiSterse } = await this.anunturi.updateEntity(id, deSalvat, noi, deSters, admin.id);
    stergeFisiere(caiSterse); // imaginile sterse dispar si de pe disc
    await this.jurnal.noteaza(admin, 'modificare', 'anunt', id, model.titlu);
    return { model };
  }

  // Butonul Activeaza (doar daca proprietatea lui e activa). Adminul activeaza = aproba.
  // Un anunt in asteptare se aproba doar de pe pagina lui (unde adminul il vede), nu dintr-un buton din lista.
  // Intoarce { negasit } | { inAsteptare } | { proprietateInactiva: denumire } | { titlu }.
  async activeaza(id, admin) {
    const entitate = await this.anunturi.getById(id);
    if (!entitate) return { negasit: true };
    if (entitate.stare === 'in_asteptare') return { inAsteptare: true };
    if (entitate.proprietate.stare === 'inactiv') return { proprietateInactiva: entitate.proprietate.denumire };
    await this.anunturi.schimbaStare(id, 'activ', { aprobat_la: entitate.aprobat_la ?? new Date() });
    await this.jurnal.noteaza(admin, 'activare', 'anunt', id, entitate.titlu);
    return { titlu: entitate.titlu };
  }

  // Intoarce { negasit } | { titlu }.
  async dezactiveaza(id, admin) {
    const entitate = await this.anunturi.getById(id);
    if (!entitate) return { negasit: true };
    await this.anunturi.schimbaStare(id, 'inactiv');
    await this.jurnal.noteaza(admin, 'dezactivare', 'anunt', id, entitate.titlu);
    return { titlu: entitate.titlu };
  }

  // Anuntul in asteptare devine activ (public). versiune = amprenta variantei pe care a vazut-o adminul.
  // Intoarce { negasit } | { proprietateInactiva } | { versiuneVeche } | { nuMaiAsteapta } | { titlu }.
  async aproba(id, versiune, admin) {
    const entitate = await this.anunturi.getById(id);
    if (!entitate) return { negasit: true };
    if (entitate.proprietate.stare === 'inactiv') return { proprietateInactiva: entitate.proprietate.denumire };
    // Daca proprietarul a modificat anuntul intre timp, amprenta trimisa nu mai e cea de acum -> nu aprobam.
    const imagini = await this.anunturi.getImagini([id]);
    if (String(versiune || '') !== amprentaContinut(entitate, imagini.map((f) => f.id))) return { versiuneVeche: true };
    // Conditia "in asteptare" e verificata chiar in baza de date (vezi accesorul): doi admini deodata nu-l aproba de doua ori.
    if (!(await this.anunturi.aproba(id))) return { nuMaiAsteapta: true };
    await this.jurnal.noteaza(admin, 'aprobare', 'anunt', id, entitate.titlu);
    await anuntaProprietarul(entitate, emailuri.anuntAprobat(entitate.proprietate.utilizator, entitate.titlu));
    return { titlu: entitate.titlu };
  }

  // Respingerea, cu motiv obligatoriu (il vede proprietarul, ca sa stie ce sa corecteze).
  // Intoarce { negasit } | { eroare } | { nuSePoate } | { titlu }.
  async respinge(id, motivTrimis, admin) {
    const entitate = await this.anunturi.getById(id);
    if (!entitate) return { negasit: true };
    const { motiv, eroare } = valideazaMotiv(motivTrimis);
    if (eroare) return { eroare };
    if (!(await this.anunturi.respinge(id, motiv))) return { nuSePoate: true };
    await this.jurnal.noteaza(admin, 'respingere', 'anunt', id, `${entitate.titlu} – motiv: ${motiv}`);
    await anuntaProprietarul(entitate, emailuri.anuntRespins(entitate.proprietate.utilizator, entitate.titlu, motiv));
    return { titlu: entitate.titlu };
  }

  // Readuce un anunt sters logic, ca CIORNA. Intoarce anuntul sau null (daca nu mai e printre cele sterse).
  async restaureaza(id, admin) {
    const anunt = await this.anunturi.restaureaza(id);
    if (anunt) await this.jurnal.noteaza(admin, 'restaurare', 'anunt', id, anunt.titlu);
    return anunt;
  }
}

module.exports = AnunturiAdmin;
module.exports.SORTARI = SORTARI;
