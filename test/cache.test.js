// Regulile cache-ului (servicii/cache.js): fara baza de date, cu o functie de incarcare care numara apelurile.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Cache = require('../servicii/cache');

// O "citire din baza de date" falsa, care tine minte de cate ori a fost chemata.
function citireFalsa(valoare) {
  const f = async () => {
    f.apeluri++;
    return valoare;
  };
  f.apeluri = 0;
  return f;
}

test('a doua cerere pentru aceeasi cheie vine din cache (fara a doua citire)', async () => {
  const cache = new Cache();
  const citeste = citireFalsa(['Gratuit', 'Premium']);
  assert.deepEqual(await cache.obtine('planuri:proprietar', citeste), ['Gratuit', 'Premium']);
  assert.deepEqual(await cache.obtine('planuri:proprietar', citeste), ['Gratuit', 'Premium']);
  assert.equal(citeste.apeluri, 1);
  assert.deepEqual(cache.statistici(), { gasite: 1, citite: 1, chei: ['planuri:proprietar'] });
});

test('dupa ce expira durata, se citeste din nou', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 0 });
  const cache = new Cache();
  const citeste = citireFalsa('date');
  await cache.obtine('k', citeste, { secunde: 60 });
  t.mock.timers.tick(59_000);
  await cache.obtine('k', citeste, { secunde: 60 });
  assert.equal(citeste.apeluri, 1, 'inca valabil la 59 de secunde');
  t.mock.timers.tick(1_000);
  await cache.obtine('k', citeste, { secunde: 60 });
  assert.equal(citeste.apeluri, 2, 'expirat la 60 de secunde');
});

test('sterge(prefix) goleste doar cheile cu acel prefix', async () => {
  const cache = new Cache();
  const planuri = citireFalsa('planuri');
  const orase = citireFalsa('orase');
  await cache.obtine('planuri:proprietar', planuri);
  await cache.obtine('planuri:chirias', planuri);
  await cache.obtine('orase', orase);
  assert.equal(cache.sterge('planuri:'), 2);
  await cache.obtine('planuri:proprietar', planuri);
  await cache.obtine('orase', orase);
  assert.equal(planuri.apeluri, 3, 'planurile s-au citit din nou');
  assert.equal(orase.apeluri, 1, 'orasele au ramas in cache');
});

test('doua cereri simultane pentru aceeasi cheie fac o singura citire', async () => {
  const cache = new Cache();
  const citeste = citireFalsa(42);
  const [a, b] = await Promise.all([cache.obtine('k', citeste), cache.obtine('k', citeste)]);
  assert.equal(a, 42);
  assert.equal(b, 42);
  assert.equal(citeste.apeluri, 1);
});

test('o citire esuata nu ramane in cache (urmatoarea incearca din nou)', async () => {
  const cache = new Cache();
  let incercari = 0;
  const citeste = async () => {
    incercari++;
    if (incercari === 1) throw new Error('baza de date indisponibila');
    return 'ok';
  };
  await assert.rejects(cache.obtine('k', citeste), /indisponibila/);
  assert.equal(await cache.obtine('k', citeste), 'ok');
  assert.equal(incercari, 2);
});
