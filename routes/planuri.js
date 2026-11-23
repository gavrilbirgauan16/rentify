// Rutele pentru planurile de abonament (in /admin/planuri).
const express = require('express');
const PlanuriController = require('../controllers/PlanuriController');
const { actiune } = require('../infrastructura/container'); // DI: controllerul isi primeste serviciul

const router = express.Router();

router.use((req, res, next) => {
  res.locals.sectiune = 'planuri';
  next();
});

router.get('/', actiune(PlanuriController, 'index'));
router.get('/create', actiune(PlanuriController, 'createGet'));
router.post('/create', actiune(PlanuriController, 'createPost'));
router.get('/:id/edit', actiune(PlanuriController, 'editGet'));
router.post('/:id/edit', actiune(PlanuriController, 'editPost'));
router.post('/:id/activeaza', actiune(PlanuriController, 'activeaza'));
router.post('/:id/dezactiveaza', actiune(PlanuriController, 'dezactiveaza'));

module.exports = router;