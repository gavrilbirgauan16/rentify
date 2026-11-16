// Numaratorile pentru panoul de administrare (pagina /admin). Pornesc toate in paralel.
const context = require('../Repository_CodeFirst/context');

class PanouAccessor {
  async numaratori() {
    const [proprietati, proprietatiActive, anunturi, anunturiActive, anunturiCiorna, anunturiPeInactive, anunturiInAsteptare] = await Promise.all([
      context.proprietate.count(),
      context.proprietate.count({ where: { NOT: { stare: 'inactiv' } } }),
      context.anunt.count(),
      context.anunt.count({ where: { stare: 'activ' } }),
      context.anunt.count({ where: { stare: 'ciorna' } }),
      // anunturi care nu sunt inactive, dar proprietatea lor e inactiva (n-ar trebui sa existe)
      context.anunt.count({ where: { NOT: { stare: 'inactiv' }, proprietate: { stare: 'inactiv' } } }),
      context.anunt.count({ where: { stare: 'in_asteptare' } }), // asteapta aprobarea adminului
    ]);
    return { proprietati, proprietatiActive, anunturi, anunturiActive, anunturiCiorna, anunturiPeInactive, anunturiInAsteptare };
  }
}

module.exports = PanouAccessor;
