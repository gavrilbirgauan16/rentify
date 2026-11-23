// Rutele pentru proprietati: fiecare adresa trimite cererea la o actiune din controller.
const express = require('express');
const ProprietatiController = require('../controllers/ProprietatiController');
const { actiune } = require('../infrastructura/container'); // DI: controllerul isi primeste serviciul

const router = express.Router();

// Marcheaza sectiunea curenta, ca meniul sa o evidentieze.
router.use((req, res, next) => {
  res.locals.sectiune = 'proprietati';
  next();
});

router.get('/', actiune(ProprietatiController, 'index'));
router.get('/create', actiune(ProprietatiController, 'createGet'));
router.post('/create', actiune(ProprietatiController, 'createPost'));
router.get('/:id', actiune(ProprietatiController, 'details'));
router.get('/:id/edit', actiune(ProprietatiController, 'editGet'));
router.post('/:id/edit', actiune(ProprietatiController, 'editPost'));
router.post('/:id/dezactiveaza', actiune(ProprietatiController, 'dezactiveaza'));
router.post('/:id/activeaza', actiune(ProprietatiController, 'activeaza'));

module.exports = router;