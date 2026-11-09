// Exercitiul 7: Eager loading si Lazy loading pe relatia rol -> utilizator.
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

// Client separat, care raporteaza fiecare interogare SQL trimisa la baza de date.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  log: [{ emit: 'event', level: 'query' }],
});

let interogari = 0;
prisma.$on('query', () => { interogari++; });

async function main() {
  // EAGER: rolurile impreuna cu utilizatorii lor, intr-o singura cerere (include).
  interogari = 0;
  const roluriEager = await prisma.rol.findMany({
    include: { utilizator: true },
    orderBy: { id: 'asc' },
  });
  console.log('=== Eager loading (include) ===');
  for (const r of roluriEager) {
    console.log(`${r.nume}: ${r.utilizator.map((u) => u.prenume).join(', ') || '-'}`);
  }
  console.log(`Interogari SQL: ${interogari}\n`);

  // LAZY: intai doar rolurile, apoi utilizatorii fiecarui rol, la cerere.
  interogari = 0;
  const roluriLazy = await prisma.rol.findMany({ orderBy: { id: 'asc' } });
  console.log('=== Lazy loading (la cerere) ===');
  for (const r of roluriLazy) {
    const utilizatori = await prisma.rol.findUnique({ where: { id: r.id } }).utilizator();
    console.log(`${r.nume}: ${utilizatori.map((u) => u.prenume).join(', ') || '-'}`);
  }
  console.log(`Interogari SQL: ${interogari}`);
}

main()
  .catch((eroare) => {
    console.error('Eroare:', eroare.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());