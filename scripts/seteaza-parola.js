// Seteaza parola unui utilizator din linia de comanda (pentru conturile de test).
// Folosire:  node scripts/seteaza-parola.js admin@rentify.test ParolaMea123
require('dotenv/config');
const context = require('../src/Repository_CodeFirst/context');
const UtilizatorAccessor = require('../src/NivelAccesDate/UtilizatorAccessor');
const { hashParola, verificaReguliParola } = require('../servicii/parole');

async function main() {
  const [email, parola] = process.argv.slice(2);
  if (!email || !parola) {
    console.log('Folosire: node scripts/seteaza-parola.js <email> <parola>');
    process.exitCode = 1;
    return;
  }
  const eroare = verificaReguliParola(parola);
  if (eroare) {
    console.log(eroare);
    process.exitCode = 1;
    return;
  }
  const utilizatori = new UtilizatorAccessor();
  const u = await utilizatori.getByEmail(email.trim().toLowerCase());
  if (!u) {
    console.log(`Nu exista niciun utilizator cu emailul ${email}.`);
    process.exitCode = 1;
    return;
  }
  await utilizatori.seteazaParola(u.id, await hashParola(parola));
  console.log(`Parola a fost setata pentru ${u.prenume} ${u.nume} (${u.rol.nume}).`);
}

main()
  .catch((eroare) => {
    console.error('Eroare:', eroare.message);
    process.exitCode = 1;
  })
  .finally(() => context.$disconnect());