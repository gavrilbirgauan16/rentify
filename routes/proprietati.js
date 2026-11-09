// Rutele pentru proprietati: fiecare adresa trimite cererea la o actiune din controller.
const express = require('express');
const controller = require('../controllers/ProprietatiController');

const router = express.Router();

// Marcheaza sectiunea curenta, ca meniul sa o evidentieze.
router.use((req, res, next) => {
  res.locals.sectiune = 'proprietati';
  next();
});

router.get('/', controller.index);
router.get('/create', controller.createGet);
router.post('/create', controller.createPost);
router.get('/:id', controller.details);
router.get('/:id/edit', controller.editGet);
router.post('/:id/edit', controller.editPost);
router.post('/:id/dezactiveaza', controller.dezactiveaza);
router.post('/:id/activeaza', controller.activeaza);

module.exports = router;