// Containerul de Dependency Injection (laboratorul 10) - echivalentul clasei ContainerConfigurer cu Autofac din .NET.
// Aici, si DOAR aici, se spune cum se construieste fiecare piesa a aplicatiei si cat traieste ea.
// Celelalte clase nu-si mai creeaza singure dependintele (fara "new XAccessor()"): le primesc prin constructor.
//
// Biblioteca: Awilix (echivalentul lui Autofac in Node.js). Cele 3 durate de viata:
//   SINGLETON - un singur obiect pentru toata aplicatia (ex. conexiunea la baza de date)
//   SCOPED    - un obiect pe fiecare cerere HTTP (toti cei care lucreaza la aceeasi cerere il impart)
//   TRANSIENT - un obiect nou de fiecare data cand e cerut
const { createContainer, asClass, asValue, InjectionMode } = require('awilix');

const context = require('../src/Repository_CodeFirst/context');
const AbonamentAccessor = require('../src/NivelAccesDate/AbonamentAccessor');
const AnuntAccessor = require('../src/NivelAccesDate/AnuntAccessor');
const ContactareAccessor = require('../src/NivelAccesDate/ContactareAccessor');
const FavoritAccessor = require('../src/NivelAccesDate/FavoritAccessor');
const JurnalAccessor = require('../src/NivelAccesDate/JurnalAccessor');
const PanouAccessor = require('../src/NivelAccesDate/PanouAccessor');
const PlanAccessor = require('../src/NivelAccesDate/PlanAccessor');
const ProprietateAccessor = require('../src/NivelAccesDate/ProprietateAccessor');
const TokenAccessor = require('../src/NivelAccesDate/TokenAccessor');
const UtilizatorAccessor = require('../src/NivelAccesDate/UtilizatorAccessor');

function creeazaContainer() {
  const container = createContainer({
    // PROXY: constructorul primeste un obiect din care isi ia, dupa nume, ce ii trebuie:
    //   constructor({ context, anuntAccessor }) { ... }
    injectionMode: InjectionMode.PROXY,
    // strict: containerul refuza greselile de durata de viata (ex. un Singleton care ar tine minte un obiect
    // Scoped - adica datele unei singure cereri - pentru totdeauna).
    strict: true,
  });

  container.register({
    // Nivelul de acces la date (DbContext): UN SINGUR obiect pentru toata aplicatia (Singleton).
    // PrismaClient tine un "pool" de conexiuni la PostgreSQL: daca am crea unul nou la fiecare cerere,
    // baza de date ar ramane repede fara conexiuni libere.
    context: asValue(context),

    // Accesorii (NivelAccesDate): cate unul pe cerere (Scoped). Nu tin date intre cereri.
    abonamentAccessor: asClass(AbonamentAccessor).scoped(),
    anuntAccessor: asClass(AnuntAccessor).scoped(),
    contactareAccessor: asClass(ContactareAccessor).scoped(),
    favoritAccessor: asClass(FavoritAccessor).scoped(),
    jurnalAccessor: asClass(JurnalAccessor).scoped(),
    panouAccessor: asClass(PanouAccessor).scoped(),
    planAccessor: asClass(PlanAccessor).scoped(),
    proprietateAccessor: asClass(ProprietateAccessor).scoped(),
    tokenAccessor: asClass(TokenAccessor).scoped(),
    utilizatorAccessor: asClass(UtilizatorAccessor).scoped(),
  });

  return container;
}

// Un singur container pentru toata aplicatia.
const container = creeazaContainer();

// Middleware: fiecare cerere HTTP primeste propriul "scope" (req.container). Obiectele Scoped traiesc cat cererea;
// la urmatoarea cerere se creeaza altele.
function scopPeCerere(req, res, next) {
  req.container = container.createScope();
  next();
}

module.exports = { container, scopPeCerere };
