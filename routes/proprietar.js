// Zona proprietarului (/proprietar/...). O singura regula pentru toate paginile de aici:
// trebuie sa fii conectat si sa ai rolul "proprietar" (ca /admin pentru administrator).
const express = require('express');
const { cereAutentificare, cereRol } = require('../middleware/autentificare');
const proprietati = require('../controllers/proprietar/ProprietatiController');
const anunturi = require('../controllers/proprietar/AnunturiController');
const abonament = require('../controllers/proprietar/AbonamentController');
const { incarcaImagini } = require('../middleware/incarcareImagini');

const router = express.Router();

router.use(cereAutentificare, cereRol('proprietar'));

// Id-ul proprietarului conectat, luat din sesiune. Controllerele folosesc DOAR acesta,
// niciodata un id trimis din formular sau din adresa.
router.use((req, res, next) => {
  req.idUtilizator = res.locals.utilizator.id;
  next();
});

const sectiune = (nume) => (req, res, next) => { res.locals.sectiune = nume; next(); };

router.use('/proprietati', sectiune('proprietati'));
router.get('/proprietati', proprietati.index);
router.get('/proprietati/create', proprietati.createGet);
router.post('/proprietati/create', proprietati.createPost);
router.get('/proprietati/:id/edit', proprietati.editGet);
router.post('/proprietati/:id/edit', proprietati.editPost);
router.post('/proprietati/:id/dezactiveaza', proprietati.dezactiveaza);
router.post('/proprietati/:id/activeaza', proprietati.activeaza);

// Anunturile mele. Formularele cu imagini trec intai prin incarcaImagini (care verifica si tokenul CSRF).
router.use('/anunturi', sectiune('anunturi'));
router.get('/anunturi', anunturi.index);
router.get('/anunturi/create', anunturi.createGet);
router.post('/anunturi/create', incarcaImagini, anunturi.createPost);
router.get('/anunturi/:id/edit', anunturi.editGet);
router.post('/anunturi/:id/edit', incarcaImagini, anunturi.editPost);
router.post('/anunturi/:id/activeaza', anunturi.activeaza);
router.post('/anunturi/:id/dezactiveaza', anunturi.dezactiveaza);
router.post('/anunturi/:id/sterge', anunturi.sterge); // stergere logica (formularul are token CSRF)

// Abonamentul meu: afisare, schimbarea planului (confirmare + plata simulata), anularea unei schimbari programate.
router.use('/abonament', sectiune('abonament'));
router.get('/abonament', abonament.index);
router.get('/abonament/schimba', abonament.schimbaGet);
router.post('/abonament/schimba', abonament.schimbaPost);
router.post('/abonament/anuleaza-programat', abonament.anuleazaProgramatPost);

module.exports = router;
