// Rutele pentru planurile de abonament (in /admin/planuri).
const express = require('express');
const controller = require('../controllers/PlanuriController');

const router = express.Router();

router.use((req, res, next) => {
  res.locals.sectiune = 'planuri';
  next();
});

router.get('/', controller.index);
router.get('/create', controller.createGet);
router.post('/create', controller.createPost);
router.get('/:id/edit', controller.editGet);
router.post('/:id/edit', controller.editPost);
router.post('/:id/activeaza', controller.activeaza);
router.post('/:id/dezactiveaza', controller.dezactiveaza);

module.exports = router;