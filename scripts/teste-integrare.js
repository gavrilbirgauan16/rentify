// Ruleaza testele de integrare (API-ul cu baza de date reala), pe o baza SEPARATA de test.
// Folosire: npm run test:integrare
//  1. citeste setarile din .env.test (pe GitHub, setarile vin din workflow, fara fisier);
//  2. SIGURANTA: refuza sa porneasca daca baza nu se termina cu "_test" (nu atinge niciodata rentify_cf);
//  3. reface baza de test de la zero, din migrari (aceeasi structura ca baza ta, fara datele tale);
//  4. ruleaza testele din test/integrare/.
const fs = require('fs');
const { spawnSync } = require('child_process');

if (fs.existsSync('.env.test')) process.loadEnvFile('.env.test');

const url = process.env.DATABASE_URL;
let numeBaza = '';
try { numeBaza = new URL(url).pathname.replace(/^\//, ''); } catch { /* adresa lipsa sau gresita: oprim mai jos */ }
if (!numeBaza.endsWith('_test')) {
  console.error(`Opresc testele: baza "${numeBaza || '(lipsa)'}" nu se termina cu "_test".`);
  console.error('Testele de integrare sterg si refac baza de date. Creeaza .env.test din .env.test.example (baza rentify_test).');
  process.exit(1);
}
process.env.NODE_ENV = 'test';

// Ruleaza o comanda si opreste totul daca esueaza. shell: true ca "npx" sa mearga si pe Windows.
function ruleaza(comanda, explicatie) {
  console.log(`\n> ${explicatie}`);
  const r = spawnSync(comanda, { stdio: 'inherit', shell: true, env: process.env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

ruleaza('npx prisma migrate reset --force', `Refac baza de test "${numeBaza}" din migrari`);
ruleaza('node --test --test-concurrency=1 "test/integrare/*.test.js"', 'Rulez testele de integrare');
