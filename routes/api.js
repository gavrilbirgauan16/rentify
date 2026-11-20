// API-ul aplicatiei, sub /api. Primeste si trimite JSON. Doua feluri de clienti:
//  - programe (Postman, alte aplicatii): cheia API in antetul x-api-key, fara cookie-uri (laboratorul 7);
//  - interfata React din browser: contul conectat (cookie de sesiune) + tokenul CSRF in antetul x-csrf-token.
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { cereCheie } = require('../middleware/cheieApi');
const { asiguraToken, verificaTokenApi } = require('../middleware/csrf');
const anunturi = require('../controllers/api/AnunturiApiController');
const auth = require('../controllers/api/AutentificareApiController');
const chirias = require('../controllers/api/ChiriasApiController');
const conturi = require('../controllers/api/ConturiApiController');
const cont = require('../controllers/api/ContApiController');
const proprietati = require('../controllers/api/ProprietatiApiController');
const anunturiProprietar = require('../controllers/api/AnunturiProprietarApiController');
const { incarcaImagini } = require('../middleware/incarcareImagini');
const { cereConectatApi, cereAutentificareApi, cereRolApi } = require('../middleware/autentificare');

const router = express.Router();

// In testele de integrare (NODE_ENV=test) toate cererile vin de pe acelasi calculator, unele dupa altele:
// limitele sunt de 100 de ori mai mari, ca testele sa nu pice din cauza lor. In aplicatia reala raman neschimbate.
const FACTOR_LIMITE = process.env.NODE_ENV === 'test' ? 100 : 1;

// Cel mult 300 de cereri in 15 minute de pe acelasi calculator (protectie impotriva abuzului).
router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 * FACTOR_LIMITE, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { eroare: 'Prea multe cereri. Încearcă din nou peste câteva minute.' } }));

// Citeste Body-ul JSON (cel mult 100 KB).
router.use(express.json({ limit: '100kb' }));

// Protectie CSRF pentru cererile din browser care schimba ceva (cele cu cheie API sunt scutite).
router.use(verificaTokenApi);

// Tokenul CSRF pentru interfata React: il cere o data (si din nou dupa login / logout, cand sesiunea se schimba).
router.get('/auth/csrf', (req, res) => res.json({ csrfToken: asiguraToken(req) }));

// Limite de cereri pe calculator (IP), cu raspuns JSON. Aceleasi valori ca la paginile echivalente.
const limita = (minute, maxim, extra = {}) => rateLimit({
  windowMs: minute * 60 * 1000, limit: maxim * FACTOR_LIMITE, standardHeaders: 'draft-8', legacyHeaders: false, ...extra,
  message: { eroare: `Prea multe cereri într-un timp scurt. Încearcă din nou peste ${minute} de minute.` },
});
// Login: cel mult 10 incercari GRESITE in 15 minute (impotriva ghicirii parolei).
const limitaLogin = limita(15, 10, { skipSuccessfulRequests: true });
const limitaInregistrare = limita(60, 10); // conturi false in masa
const limitaEmailuri = limita(15, 5); // emailuri trimise la nesfarsit catre cineva
const limitaResetare = limita(15, 10); // incercari de tokenuri

router.post('/auth/login', limitaLogin, auth.login);
router.post('/auth/logout', auth.logout);
router.get('/auth/eu', auth.eu);

// Conturi: inregistrare, confirmarea emailului, parola uitata (fara cont conectat).
router.post('/auth/inregistrare', limitaInregistrare, conturi.inregistrare);
router.post('/auth/confirmare', limitaResetare, conturi.confirmare);
router.post('/auth/confirmare/retrimite', limitaEmailuri, conturi.retrimiteConfirmarea);
router.post('/auth/parola-uitata', limitaEmailuri, conturi.parolaUitata);
router.get('/auth/resetare/:token', limitaResetare, conturi.verificaResetarea);
router.post('/auth/resetare', limitaResetare, conturi.resetare);

router.get('/anunturi', anunturi.getAll);
router.get('/anunturi/:id', anunturi.getById);
router.post('/anunturi', cereCheie, anunturi.post);
router.put('/anunturi/:id', cereCheie, anunturi.put);

// Contul meu (orice rol conectat). Schimbarea parolei merge si cu parola temporara de la admin (altfel ar ramane blocat).
// Parola si emailul: cel mult 10 incercari in 15 minute (nu se poate ghici parola curenta de aici).
const limitaParola = limita(15, 10);
router.get('/cont', cereAutentificareApi, cont.profil);
router.put('/cont', cereAutentificareApi, cont.modificaProfil);
router.post('/cont/parola', cereConectatApi, limitaParola, cont.schimbaParola);
router.post('/cont/email', cereAutentificareApi, limitaParola, cont.cereSchimbareaEmailului);
router.post('/cont/email/confirmare', limitaResetare, cont.confirmaEmailul);

// Chiriasul conectat: contactarea proprietarului (cu limita din plan) si favoritele.
const doarChirias = [cereAutentificareApi, cereRolApi('chirias')];
router.get('/contactari', doarChirias, chirias.situatie);
router.post('/anunturi/:id/contact', doarChirias, chirias.contact);
router.get('/favorite', doarChirias, chirias.listaFavorite);
router.post('/favorite/:id', doarChirias, chirias.adaugaFavorit);
router.delete('/favorite/:id', doarChirias, chirias.stergeFavorit);

// Proprietarul conectat: proprietatile lui (limita din plan, doar ale lui).
const doarProprietar = [cereAutentificareApi, cereRolApi('proprietar')];
router.get('/proprietar/proprietati', doarProprietar, proprietati.lista);
router.get('/proprietar/proprietati/:id', doarProprietar, proprietati.una);
router.post('/proprietar/proprietati', doarProprietar, proprietati.adauga);
router.put('/proprietar/proprietati/:id', doarProprietar, proprietati.modifica);
router.post('/proprietar/proprietati/:id/dezactiveaza', doarProprietar, proprietati.dezactiveaza);
router.post('/proprietar/proprietati/:id/activeaza', doarProprietar, proprietati.activeaza);

// Proprietarul conectat: anunturile lui (limita, moderarea, doar pe proprietatile lui).
router.get('/proprietar/anunturi', doarProprietar, anunturiProprietar.lista);
router.get('/proprietar/anunturi/:id', doarProprietar, anunturiProprietar.unul);
router.post('/proprietar/anunturi', doarProprietar, anunturiProprietar.adauga);
router.put('/proprietar/anunturi/:id', doarProprietar, anunturiProprietar.modifica);
router.post('/proprietar/anunturi/:id/publica', doarProprietar, anunturiProprietar.publica);
router.post('/proprietar/anunturi/:id/retrage', doarProprietar, anunturiProprietar.retrage);
// Pozele: intai rolul (cine nu e proprietar nu poate urca nimic), apoi incarcarea si verificarea fisierelor.
router.post('/proprietar/anunturi/:id/imagini', doarProprietar, incarcaImagini, anunturiProprietar.adaugaImagini);
router.delete('/proprietar/anunturi/:id/imagini/:idImagine', doarProprietar, anunturiProprietar.stergeImagine);

// Orice alta adresa din /api: raspuns JSON, nu pagina HTML.
router.use((req, res) => res.status(404).json({ eroare: 'Adresa API nu există.' }));

// Erorile din API tot ca JSON (ex. JSON scris gresit in Body -> 400).
router.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ eroare: 'Body-ul nu este JSON valid.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ eroare: 'Body-ul este prea mare.' });
  console.error(err);
  res.status(500).json({ eroare: 'Eroare pe server. Încearcă din nou mai târziu.' });
});

module.exports = router;