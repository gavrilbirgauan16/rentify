// Rutele pentru contul utilizatorului conectat (/cont/...), pentru orice rol: profil, parola, email.
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { cereAutentificare } = require('../middleware/autentificare');
const controller = require('../controllers/ContController');

const router = express.Router();
router.use(cereAutentificare);

// Ca la login: cel mult 10 incercari in 15 minute (nu se poate ghici parola curenta de aici). Comuna pentru parola si email.
const limitaParola = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => {
    const erori = { parola_curenta: 'Prea multe încercări. Încearcă din nou peste 15 minute.' };
    if (req.path === '/email') return res.status(429).render('cont/email', { email: String(req.body.email || ''), erori, sectiune: 'cont' });
    res.status(429).render('cont/parola', { erori, obligatoriu: res.locals.utilizator.schimbaParola, sectiune: 'cont' });
  },
});

router.get('/', controller.profilGet);
router.post('/', controller.profilPost);
router.get('/parola', controller.parolaGet);
router.post('/parola', limitaParola, controller.parolaPost);
router.get('/email', controller.emailGet);
router.post('/email', limitaParola, controller.emailPost);

module.exports = router;
