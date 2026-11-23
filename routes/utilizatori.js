// Rutele pentru utilizatori (in /admin/utilizatori).
const express = require('express');
const UtilizatoriController = require('../controllers/UtilizatoriController');
const { actiune } = require('../infrastructura/container'); // DI: controllerul isi primeste serviciul

const router = express.Router();
router.use((req, res, next) => { res.locals.sectiune = 'utilizatori'; next(); });

router.get('/', actiune(UtilizatoriController, 'index'));
router.get('/:id', actiune(UtilizatoriController, 'details'));
router.post('/:id/blocheaza', actiune(UtilizatoriController, 'blocheaza'));
router.post('/:id/deblocheaza', actiune(UtilizatoriController, 'deblocheaza'));
router.post('/:id/reseteaza-parola', actiune(UtilizatoriController, 'reseteazaParola'));
router.post('/:id/trimite-link-resetare', actiune(UtilizatoriController, 'trimiteLinkParola'));
router.post('/:id/retrimite-confirmare', actiune(UtilizatoriController, 'retrimiteConfirmare'));

module.exports = router;
