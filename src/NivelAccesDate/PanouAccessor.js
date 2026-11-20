// Numaratorile pentru panoul de administrare (pagina /admin). Pornesc toate in paralel.
const context = require('../Repository_CodeFirst/context');
const { NESTERS } = require('./AnuntAccessor');

class PanouAccessor {
  async numaratori() {
    const [proprietati, proprietatiActive, anunturi, anunturiActive, anunturiPeInactive, anunturiInAsteptare] = await Promise.all([
      context.proprietate.count(),
      context.proprietate.count({ where: { NOT: { stare: 'inactiv' } } }),
      context.anunt.count({ where: NESTERS }), // anunturile sterse logic nu se numara
      context.anunt.count({ where: { stare: 'activ', ...NESTERS } }),
      // anunturi care nu sunt inactive, dar proprietatea lor e inactiva (n-ar trebui sa existe)
      context.anunt.count({ where: { NOT: { stare: 'inactiv' }, ...NESTERS, proprietate: { stare: 'inactiv' } } }),
      context.anunt.count({ where: { stare: 'in_asteptare', ...NESTERS } }), // asteapta aprobarea adminului
    ]);
    return { proprietati, proprietatiActive, anunturi, anunturiActive, anunturiPeInactive, anunturiInAsteptare };
  }
}

module.exports = PanouAccessor;
