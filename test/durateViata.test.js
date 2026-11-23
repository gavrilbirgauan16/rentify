// Laboratorul 10, exercitiul 3: cele trei durate de viata din containerul DI (infrastructura/container.js).
//   SINGLETON - un singur obiect pentru toata aplicatia:        context (PrismaClient), cache
//   SCOPED    - un obiect pe cerere HTTP (un "scope" = o cerere): accesorii si serviciile
//   TRANSIENT - un obiect nou de fiecare data:                    controllerele (construite la fiecare cerere)
// Testul nu se conecteaza la baza de date: doar construieste obiectele si le compara (=== inseamna "acelasi obiect").
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createContainer, asClass, InjectionMode } = require('awilix');
const { container } = require('../infrastructura/container');
const AnunturiController = require('../controllers/AnunturiController');

test('SINGLETON: contextul si cache-ul sunt aceleasi pentru toate cererile', () => {
  const cerere1 = container.createScope();
  const cerere2 = container.createScope();
  assert.equal(cerere1.resolve('context'), cerere2.resolve('context'));
  assert.equal(cerere1.resolve('cache'), cerere2.resolve('cache'));
  assert.equal(cerere1.resolve('cache'), container.resolve('cache'));
});

test('SCOPED: in aceeasi cerere, acelasi accesor; la alta cerere, altul', () => {
  const cerere1 = container.createScope();
  const cerere2 = container.createScope();
  assert.equal(cerere1.resolve('anuntAccessor'), cerere1.resolve('anuntAccessor'));
  assert.notEqual(cerere1.resolve('anuntAccessor'), cerere2.resolve('anuntAccessor'));
});

test('SCOPED: serviciile aceleiasi cereri impart accesorii (nu-si fac fiecare unul)', () => {
  const cerere = container.createScope();
  const anunturiProprietar = cerere.resolve('anunturiProprietar');
  const verificariPlan = cerere.resolve('verificariPlan');
  assert.equal(anunturiProprietar.anunturi, cerere.resolve('anuntAccessor'));
  assert.equal(anunturiProprietar.verificariPlan, verificariPlan);
  assert.equal(verificariPlan.anunturi, anunturiProprietar.anunturi);
});

test('SCOPED + SINGLETON: servicii diferite (si cereri diferite) primesc acelasi cache', () => {
  const a = container.createScope().resolve('abonamentProprietar');
  const b = container.createScope().resolve('planuriAdmin');
  assert.notEqual(a, container.createScope().resolve('abonamentProprietar'));
  assert.equal(a.cache, b.cache);
});

test('TRANSIENT: controllerul se construieste din nou la fiecare folosire, chiar in aceeasi cerere', () => {
  const cerere = container.createScope();
  const c1 = cerere.build(AnunturiController);
  const c2 = cerere.build(AnunturiController);
  assert.notEqual(c1, c2);
  assert.equal(typeof c1.index, 'function');
});

test('strict: un Singleton NU poate depinde de un obiect Scoped (ar tine minte o cerere pentru totdeauna)', () => {
  // Acelasi fel de container ca al aplicatiei, cu o greseala facuta intentionat.
  class Accesor {}
  class CacheGresit {
    constructor({ accesor }) { this.accesor = accesor; }
  }
  const gresit = createContainer({ injectionMode: InjectionMode.PROXY, strict: true });
  gresit.register({ accesor: asClass(Accesor).scoped(), cacheGresit: asClass(CacheGresit).singleton() });
  // Mesajul Awilix: "Dependency 'accesor' has a shorter lifetime than its ancestor: 'cacheGresit'"
  assert.throws(() => gresit.createScope().resolve('cacheGresit'), /shorter lifetime than its ancestor/);
});
