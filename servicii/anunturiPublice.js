// Anunturile prin API (laboratorul 7 + cautarea publica). Mutat aici din AnunturiApiController (laboratorul 10).
// Doua feluri de clienti:
//   - cu cheie API (admin / programe): vad si modifica orice anunt; un anunt pus "activ" prin cheie e considerat aprobat;
//   - fara cheie (chirias / vizitator): doar anunturile publice (active), cu filtre si paginare.
// Serviciul nu stie de HTTP sau de JSON: primeste date simple si intoarce entitati; controllerul le face DTO-uri.
// Dependintele (accesorii) vin prin constructor, de la containerul DI.
const AnuntViewModel = require('../models/AnuntViewModel');
const { conditie, SORTARI } = require('./cautareAnunturi');
const F = require('./filtre');

class AnunturiPublice {
  constructor({ anuntAccessor, proprietateAccessor }) {
    this.anunturi = anuntAccessor;
    this.proprietati = proprietateAccessor;
  }

  // Toate anunturile (cu cheie), optional doar cele cu o anumita stare. Intoarce { entitati, imagini }.
  async toate(stare = null) {
    let entitati = await this.anunturi.getAll();
    if (stare) entitati = entitati.filter((a) => a.stare === stare);
    return { entitati, imagini: await this.anunturi.getImagini(entitati.map((a) => a.id)) };
  }

  // Cautarea publica. f = filtrele citite din adresa (cautareAnunturi.citesteCautarea). Intoarce { entitati, imagini, pag }.
  async cauta(f) {
    const where = conditie(f);
    const pag = F.paginare(await this.anunturi.numaraPublice(where), f.pagina, f.pe_pagina);
    const entitati = await this.anunturi.cautaPublice(where, SORTARI[f.sort], pag);
    return { entitati, imagini: await this.anunturi.getImagini(entitati.map((a) => a.id)), pag };
  }

  // Orice anunt (cu cheie). null daca nu exista.
  async unul(id) {
    const entitate = await this.anunturi.getById(id);
    return entitate ? { entitate, imagini: await this.anunturi.getImagini([id]) } : null;
  }

  // Un anunt public (fara cheie); fiecare deschidere numara o vizualizare. null daca nu e public.
  async unulPublic(id) {
    const entitate = await this.anunturi.getPublicById(id);
    if (!entitate) return null;
    await this.anunturi.inregistreazaVizualizare(id);
    return { entitate: { ...entitate, vizualizari: entitate.vizualizari + 1 }, imagini: await this.anunturi.getImagini([id]) };
  }

  // Valideaza datele exact ca formularul de pe site. Intoarce { model, erori }.
  // La modificare, anuntul isi poate pastra starea actuala (ex. "in_asteptare"), chiar daca ea nu se alege din formular.
  async #valideaza(date, proprietateActuala = null, stareActuala = null) {
    const model = AnuntViewModel.dinFormular(date);
    const erori = model.valideaza(stareActuala);
    const lista = await this.proprietati.getDisponibile();
    if (proprietateActuala && !lista.some((p) => p.id === proprietateActuala.id)) lista.push(proprietateActuala);
    AnuntViewModel.verificaProprietatea(model, lista, erori);
    return { model, erori };
  }

  // Anunt nou (cu cheie). date = campurile, in forma formularului. Intoarce { erori } | { anunt }.
  async adauga(date) {
    const { model, erori } = await this.#valideaza(date);
    if (Object.keys(erori).length > 0) return { erori };
    const deSalvat = model.catreEntitate();
    const nou = await this.anunturi.addEntity({ ...deSalvat, aprobat_la: deSalvat.stare === 'activ' ? new Date() : null });
    return { anunt: await this.anunturi.getById(nou.id) };
  }

  // Inlocuieste TOATE campurile (cu cheie); imaginile raman cele existente.
  // Intoarce { negasit } | { erori } | { anunt, imagini }.
  async inlocuieste(id, date) {
    const entitate = await this.anunturi.getById(id);
    if (!entitate) return { negasit: true };
    const { model, erori } = await this.#valideaza(date, entitate.proprietate, entitate.stare);
    if (Object.keys(erori).length > 0) return { erori };
    // Ca la adaugare: trecut in "activ" prin cheie = aprobat (cel deja aprobat isi pastreaza data aprobarii).
    const deSalvat = model.catreEntitate();
    const aprobat_la = deSalvat.stare === 'activ' ? (entitate.aprobat_la ?? new Date()) : entitate.aprobat_la;
    await this.anunturi.updateEntity(id, { ...deSalvat, aprobat_la });
    return { anunt: await this.anunturi.getById(id), imagini: await this.anunturi.getImagini([id]) };
  }
}

module.exports = AnunturiPublice;
