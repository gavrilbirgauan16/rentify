// Copie de siguranta a bazei de date (backup), facuta cu pg_dump - unealta oficiala PostgreSQL.
// Ruleaza cu:  npm run backup
// Fisierul se salveaza in folderul "backups/" (care NU ajunge pe GitHub - contine date reale).
// Faci o copie INAINTE de orice migrare sau modificare riscanta.
//
// Restaurare (daca ceva s-a stricat), din CMD:
//   psql -U postgres -d rentify_cf -f backups\NUMELE_FISIERULUI.sql
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv/config');

// 1. Datele de conectare, din DATABASE_URL (.env). Parola o dam prin variabila PGPASSWORD,
//    nu in linia de comanda (acolo ar putea fi vazuta de alte programe).
const url = new URL(process.env.DATABASE_URL || '');
if (!url.hostname || !url.pathname.slice(1)) {
  console.error('DATABASE_URL lipseste sau e gresit in .env.');
  process.exit(1);
}
const baza = decodeURIComponent(url.pathname.slice(1));

// 2. Gasim pg_dump: din PATH sau din folderul standard de instalare PostgreSQL pe Windows.
function gasestePgDump() {
  if (process.env.PG_DUMP) return process.env.PG_DUMP;
  const radacina = 'C:\\Program Files\\PostgreSQL';
  if (process.platform === 'win32' && fs.existsSync(radacina)) {
    const versiuni = fs.readdirSync(radacina).filter((v) => /^\d+$/.test(v)).sort((a, b) => b - a);
    for (const v of versiuni) {
      const cale = path.join(radacina, v, 'bin', 'pg_dump.exe');
      if (fs.existsSync(cale)) return cale;
    }
  }
  return 'pg_dump';
}

// 3. Numele fisierului: baza + data si ora, ex. backups/rentify_cf_2026-11-11_00-15.sql
const acum = new Date();
const doua = (n) => String(n).padStart(2, '0');
const marca = `${acum.getFullYear()}-${doua(acum.getMonth() + 1)}-${doua(acum.getDate())}_${doua(acum.getHours())}-${doua(acum.getMinutes())}`;
const folder = path.join(__dirname, '..', 'backups');
fs.mkdirSync(folder, { recursive: true });
const fisier = path.join(folder, `${baza}_${marca}.sql`);

// 4. Rulam pg_dump. --clean --if-exists: la restaurare sterge intai tabelele vechi, apoi le pune pe cele din copie.
const rezultat = spawnSync(gasestePgDump(), [
  '--host', url.hostname,
  '--port', url.port || '5432',
  '--username', decodeURIComponent(url.username),
  '--dbname', baza,
  '--clean', '--if-exists', '--no-owner',
  '--encoding', 'UTF8',
  '--file', fisier,
], { env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) }, stdio: ['ignore', 'inherit', 'inherit'] });

if (rezultat.error) {
  console.error(`Nu am gasit pg_dump (${rezultat.error.message}). Seteaza PG_DUMP in .env cu calea catre pg_dump.exe.`);
  process.exit(1);
}
if (rezultat.status !== 0) {
  console.error('Backup-ul a esuat (vezi mesajul de mai sus).');
  if (fs.existsSync(fisier)) fs.unlinkSync(fisier);
  process.exit(1);
}
const kb = Math.round(fs.statSync(fisier).size / 1024);
console.log(`Backup salvat: backups/${path.basename(fisier)} (${kb} KB)`);