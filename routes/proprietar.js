// Zona proprietarului (/proprietar/...). O singura regula pentru toate paginile de aici:
// trebuie sa fii conectat si sa ai rolul "proprietar" (ca /admin pentru administrator).
const express = require('express');
const { cereAutentificare, cereRol } = require('../middleware/autentificare');
const proprietati = require('../controllers/proprietar/ProprietatiController');

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

module.exports = router;
