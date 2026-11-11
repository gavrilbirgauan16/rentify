// Rutele pentru utilizatori (in /admin/utilizatori).
const express = require('express');
const controller = require('../controllers/UtilizatoriController');

const router = express.Router();
router.use((req, res, next) => { res.locals.sectiune = 'utilizatori'; next(); });

router.get('/', controller.index);
router.get('/:id', controller.details);
router.post('/:id/blocheaza', controller.blocheaza);
router.post('/:id/deblocheaza', controller.deblocheaza);
router.post('/:id/reseteaza-parola', controller.reseteazaParola);

module.exports = router;
