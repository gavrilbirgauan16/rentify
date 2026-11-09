// Rutele pentru conectare si iesire din cont.
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const controller = require('../controllers/AutentificareController');

const router = express.Router();

// Limita impotriva ghicirii parolelor: cel mult 10 incercari GRESITE in 15 minute, de pe acelasi calculator.
const limitaAutentificare = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true, // conectarile reusite nu se numara
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => res.status(429).render('autentificare', {
    email: String(req.body.email || ''),
    eroare: 'Prea multe încercări greșite. Încearcă din nou peste 15 minute.',
    sectiune: 'autentificare',
  }),
});

router.get('/autentificare', controller.autentificareGet);
router.post('/autentificare', limitaAutentificare, controller.autentificarePost);
router.post('/iesire', controller.iesire);

module.exports = router;