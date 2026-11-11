// Rutele pentru abonamente (in /admin/abonamente).
const express = require('express');
const controller = require('../controllers/AbonamenteController');

const router = express.Router();
router.use((req, res, next) => { res.locals.sectiune = 'abonamente'; next(); });

router.get('/', controller.index);
router.get('/create', controller.createGet);
router.post('/create', controller.createPost);
router.get('/:id', controller.details);
router.post('/:id/plati', controller.plataPost);
router.post('/:id/anuleaza', controller.anuleaza);

module.exports = router;