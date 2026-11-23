// Zona proprietarului (/proprietar/...). O singura regula pentru toate paginile de aici:
// trebuie sa fii conectat si sa ai rolul "proprietar" (ca /admin pentru administrator).
const express = require('express');
const { cereAutentificare, cereRol } = require('../middleware/autentificare');
const ProprietatiController = require('../controllers/proprietar/ProprietatiController');
const AnunturiController = require('../controllers/proprietar/AnunturiController');
const AbonamentController = require('../controllers/proprietar/AbonamentController');
const { incarcaImagini } = require('../middleware/incarcareImagini');
const { actiune } = require('../infrastructura/container'); // DI: controllerele isi primesc serviciile

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
router.get('/proprietati', actiune(ProprietatiController, 'index'));
router.get('/proprietati/create', actiune(ProprietatiController, 'createGet'));
router.post('/proprietati/create', actiune(ProprietatiController, 'createPost'));
router.get('/proprietati/:id/edit', actiune(ProprietatiController, 'editGet'));
router.post('/proprietati/:id/edit', actiune(ProprietatiController, 'editPost'));
router.post('/proprietati/:id/dezactiveaza', actiune(ProprietatiController, 'dezactiveaza'));
router.post('/proprietati/:id/activeaza', actiune(ProprietatiController, 'activeaza'));

// Anunturile mele. Formularele cu imagini trec intai prin incarcaImagini (care verifica si tokenul CSRF).
router.use('/anunturi', sectiune('anunturi'));
router.get('/anunturi', actiune(AnunturiController, 'index'));
router.get('/anunturi/create', actiune(AnunturiController, 'createGet'));
router.post('/anunturi/create', incarcaImagini, actiune(AnunturiController, 'createPost'));
router.get('/anunturi/:id/edit', actiune(AnunturiController, 'editGet'));
router.post('/anunturi/:id/edit', incarcaImagini, actiune(AnunturiController, 'editPost'));
router.post('/anunturi/:id/activeaza', actiune(AnunturiController, 'activeaza'));
router.post('/anunturi/:id/dezactiveaza', actiune(AnunturiController, 'dezactiveaza'));
router.post('/anunturi/:id/sterge', actiune(AnunturiController, 'sterge')); // stergere logica (formularul are token CSRF)

// Abonamentul meu: afisare, schimbarea planului (confirmare + plata simulata), anularea unei schimbari programate.
router.use('/abonament', sectiune('abonament'));
router.get('/abonament', actiune(AbonamentController, 'index'));
router.get('/abonament/schimba', actiune(AbonamentController, 'schimbaGet'));
router.post('/abonament/schimba', actiune(AbonamentController, 'schimbaPost'));
router.post('/abonament/anuleaza-programat', actiune(AbonamentController, 'anuleazaProgramatPost'));

module.exports = router;
