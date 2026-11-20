// Rutele pentru anunturi: fiecare adresa trimite cererea la o actiune din controller.
const express = require('express');
const controller = require('../controllers/AnunturiController');
const { incarcaImagini } = require('../middleware/incarcareImagini');

const router = express.Router();

// Marcheaza sectiunea curenta, ca meniul sa o evidentieze.
router.use((req, res, next) => {
  res.locals.sectiune = 'anunturi';
  next();
});

router.get('/', controller.index);
router.get('/create', controller.createGet);
router.post('/create', incarcaImagini, controller.createPost); // intai se primesc imaginile, apoi se salveaza
router.get('/:id', controller.details);
router.get('/:id/edit', controller.editGet);
router.post('/:id/edit', incarcaImagini, controller.editPost);
router.post('/:id/activeaza', controller.activeaza);
router.post('/:id/dezactiveaza', controller.dezactiveaza);
router.post('/:id/aproba', controller.aproba);     // moderarea: anuntul in asteptare devine activ
router.post('/:id/respinge', controller.respinge); // moderarea: cu motiv obligatoriu
router.post('/:id/restaureaza', controller.restaureaza); // stergerea logica: readuce un anunt sters (ca ciorna)

module.exports = router;