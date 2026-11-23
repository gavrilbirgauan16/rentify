// Rutele pentru anunturi: fiecare adresa trimite cererea la o actiune din controller.
const express = require('express');
const AnunturiController = require('../controllers/AnunturiController');
const { actiune } = require('../infrastructura/container'); // DI: controllerul isi primeste serviciul
const { incarcaImagini } = require('../middleware/incarcareImagini');

const router = express.Router();

// Marcheaza sectiunea curenta, ca meniul sa o evidentieze.
router.use((req, res, next) => {
  res.locals.sectiune = 'anunturi';
  next();
});

router.get('/', actiune(AnunturiController, 'index'));
router.get('/create', actiune(AnunturiController, 'createGet'));
router.post('/create', incarcaImagini, actiune(AnunturiController, 'createPost')); // intai se primesc imaginile, apoi se salveaza
router.get('/:id', actiune(AnunturiController, 'details'));
router.get('/:id/edit', actiune(AnunturiController, 'editGet'));
router.post('/:id/edit', incarcaImagini, actiune(AnunturiController, 'editPost'));
router.post('/:id/activeaza', actiune(AnunturiController, 'activeaza'));
router.post('/:id/dezactiveaza', actiune(AnunturiController, 'dezactiveaza'));
router.post('/:id/aproba', actiune(AnunturiController, 'aproba'));     // moderarea: anuntul in asteptare devine activ
router.post('/:id/respinge', actiune(AnunturiController, 'respinge')); // moderarea: cu motiv obligatoriu
router.post('/:id/restaureaza', actiune(AnunturiController, 'restaureaza')); // stergerea logica: readuce un anunt sters (ca ciorna)

module.exports = router;