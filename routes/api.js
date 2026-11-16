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
const { cereAutentificareApi, cereRolApi } = require('../middleware/autentificare');

const router = express.Router();

// Cel mult 300 de cereri in 15 minute de pe acelasi calculator (protectie impotriva abuzului).
router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { eroare: 'Prea multe cereri. Încearcă din nou peste câteva minute.' } }));

// Citeste Body-ul JSON (cel mult 100 KB).
router.use(express.json({ limit: '100kb' }));

// Protectie CSRF pentru cererile din browser care schimba ceva (cele cu cheie API sunt scutite).
router.use(verificaTokenApi);

// Tokenul CSRF pentru interfata React: il cere o data (si din nou dupa login / logout, cand sesiunea se schimba).
router.get('/auth/csrf', (req, res) => res.json({ csrfToken: asiguraToken(req) }));

// Ca la pagina de login: cel mult 10 incercari GRESITE in 15 minute, de pe acelasi calculator (impotriva ghicirii parolei).
const limitaLogin = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { eroare: 'Prea multe încercări greșite. Încearcă din nou peste 15 minute.' },
});
router.post('/auth/login', limitaLogin, auth.login);
router.post('/auth/logout', auth.logout);
router.get('/auth/eu', auth.eu);

router.get('/anunturi', anunturi.getAll);
router.get('/anunturi/:id', anunturi.getById);
router.post('/anunturi', cereCheie, anunturi.post);
router.put('/anunturi/:id', cereCheie, anunturi.put);

// Chiriasul conectat: contactarea proprietarului (cu limita din plan) si favoritele.
const doarChirias = [cereAutentificareApi, cereRolApi('chirias')];
router.get('/contactari', doarChirias, chirias.situatie);
router.post('/anunturi/:id/contact', doarChirias, chirias.contact);
router.get('/favorite', doarChirias, chirias.listaFavorite);
router.post('/favorite/:id', doarChirias, chirias.adaugaFavorit);
router.delete('/favorite/:id', doarChirias, chirias.stergeFavorit);

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