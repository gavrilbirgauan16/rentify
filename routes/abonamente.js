// Rutele pentru abonamente (in /admin/abonamente).
const express = require('express');
const AbonamenteController = require('../controllers/AbonamenteController');
const { actiune } = require('../infrastructura/container'); // DI: controllerul isi primeste serviciul

const router = express.Router();
router.use((req, res, next) => { res.locals.sectiune = 'abonamente'; next(); });

router.get('/', actiune(AbonamenteController, 'index'));
router.get('/create', actiune(AbonamenteController, 'createGet'));
router.post('/create', actiune(AbonamenteController, 'createPost'));
router.get('/:id', actiune(AbonamenteController, 'details'));
router.post('/:id/plati', actiune(AbonamenteController, 'plataPost'));
router.post('/:id/anuleaza', actiune(AbonamenteController, 'anuleaza'));

module.exports = router;