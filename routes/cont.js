// Rutele pentru contul utilizatorului conectat (/cont/...), pentru orice rol.
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { cereAutentificare } = require('../middleware/autentificare');
const controller = require('../controllers/ContController');

const router = express.Router();
router.use(cereAutentificare);

// Ca la login: cel mult 10 incercari gresite in 15 minute (nu se poate ghici parola curenta de aici).
const limitaParola = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => res.status(429).render('cont/parola', {
    erori: { parola_curenta: 'Prea multe încercări. Încearcă din nou peste 15 minute.' },
    obligatoriu: res.locals.utilizator.schimbaParola,
    sectiune: 'cont',
  }),
});

router.get('/parola', controller.parolaGet);
router.post('/parola', limitaParola, controller.parolaPost);

module.exports = router;
