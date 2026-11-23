// Aplicatie consola: afiseaza date din baza rentify_cf, creata prin Code First.
const context = require('../Repository_CodeFirst/context');
// Accesorii ii construieste containerul DI, exact ca in aplicatie (laboratorul 10).
const { container } = require('../../infrastructura/container');
const scop = container.createScope();

const utilizatori = scop.resolve('utilizatorAccessor');

async function main() {
  console.log('=== Toti utilizatorii ===');
  for (const u of await utilizatori.getAll()) {
    console.log(`${u.id}. ${u.prenume} ${u.nume} - ${u.email} - rol: ${u.rol.nume} - oras: ${u.oras ?? '-'} - limba: ${u.limba_preferata}`);
  }

  console.log('\n=== Chiriasii ===');
  for (const u of await utilizatori.getByRol('chirias')) {
    console.log(`- ${u.prenume} ${u.nume}`);
  }

  console.log('\n=== Vizionari programate (modelul nou) ===');
  const vizionari = await context.vizionare.findMany({ include: { utilizator: true } });
  console.log(`Numar de vizionari: ${vizionari.length}`);
}

main()
  .catch((eroare) => {
    console.error('Eroare:', eroare.message);
    process.exitCode = 1;
  })
  .finally(() => context.$disconnect());