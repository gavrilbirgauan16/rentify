// Setarile (config/index.js): in teste NU se trimit niciodata emailuri reale, chiar daca SMTP e completat.
// Fiecare caz ruleaza intr-un proces separat, pentru ca setarile se citesc o singura data, la incarcare.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

function smtpActiv(envInPlus) {
  const r = spawnSync(process.execPath, ['-e', 'console.log(JSON.stringify(Boolean(require("./config").smtp)))'], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    env: {
      ...process.env,
      DOTENV_CONFIG_PATH: path.join(__dirname, 'nu-exista.env'), // fara .env-ul real al calculatorului
      DATABASE_URL: 'postgresql://x:y@localhost:5432/rentify_test',
      SESSION_SECRET: 'o-cheie-de-test-suficient-de-lunga-0123456789',
      SMTP_HOST: 'smtp.exemplu.ro',
      SMTP_USER: 'cineva@exemplu.ro',
      SMTP_PASS: 'parola-de-test',
      NODE_ENV: '',
      ...envInPlus,
    },
  });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout.trim());
}

test('cu SMTP completat, aplicatia trimite emailuri reale', () => {
  assert.equal(smtpActiv({ NODE_ENV: 'development' }), true);
});

test('in teste (NODE_ENV=test) nu se trimite niciun email real, chiar daca SMTP e completat', () => {
  assert.equal(smtpActiv({ NODE_ENV: 'test' }), false);
});
