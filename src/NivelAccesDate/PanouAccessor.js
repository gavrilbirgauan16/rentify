// Numaratorile pentru panoul de administrare (pagina /admin). Pornesc toate in paralel.
// Conexiunea la baza de date NU mai e luata direct de aici: o primeste constructorul (Dependency Injection,
// laboratorul 10), de la containerul din infrastructura/container.js.
// TEMPORAR: pana cand nimeni nu mai creeaza accesori cu "new" (pasul 4), constructorul are o valoare implicita.
const contextImplicit = require('../Repository_CodeFirst/context');
const { NESTERS } = require('./AnuntAccessor');

class PanouAccessor {
  // Dependinta primita prin constructor: contextul Prisma (echivalentul DbContext din Entity Framework).
  constructor({ context = contextImplicit } = {}) {
    this.context = context;
  }

  async numaratori() {
    const [proprietati, proprietatiActive, anunturi, anunturiActive, anunturiPeInactive, anunturiInAsteptare] = await Promise.all([
      this.context.proprietate.count(),
      this.context.proprietate.count({ where: { NOT: { stare: 'inactiv' } } }),
      this.context.anunt.count({ where: NESTERS }), // anunturile sterse logic nu se numara
      this.context.anunt.count({ where: { stare: 'activ', ...NESTERS } }),
      // anunturi care nu sunt inactive, dar proprietatea lor e inactiva (n-ar trebui sa existe)
      this.context.anunt.count({ where: { NOT: { stare: 'inactiv' }, ...NESTERS, proprietate: { stare: 'inactiv' } } }),
      this.context.anunt.count({ where: { stare: 'in_asteptare', ...NESTERS } }), // asteapta aprobarea adminului
    ]);
    return { proprietati, proprietatiActive, anunturi, anunturiActive, anunturiPeInactive, anunturiInAsteptare };
  }
}

module.exports = PanouAccessor;
