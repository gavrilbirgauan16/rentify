// Seed: date de test in tabelele rol si utilizator, inserate prin Prisma.
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  // Rolurile: upsert = le creeaza doar daca nu exista deja.
  const roluri = ['admin', 'proprietar', 'chirias'];
  for (const nume of roluri) {
    await prisma.rol.upsert({
      where: { nume },
      update: {},
      create: { nume, descriere: 'Adaugat din seed' },
    });
  }

  const chirias = await prisma.rol.findUnique({ where: { nume: 'chirias' } });

  // Utilizatori noi: chiriasii Ionel si Vasile.
  const utilizatori = [
    { email: 'ionel.rusu@rentify.test', nume: 'Rusu', prenume: 'Ionel', telefon: '0700000004' },
    { email: 'vasile.munteanu@rentify.test', nume: 'Munteanu', prenume: 'Vasile', telefon: '0700000005' },
  ];
  for (const u of utilizatori) {
    await prisma.utilizator.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, parola_hash: 'hash_de_test', rol_id: chirias.id },
    });
  }

  console.log('Seed terminat.');
}

main()
  .catch((eroare) => {
    console.error(eroare);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());