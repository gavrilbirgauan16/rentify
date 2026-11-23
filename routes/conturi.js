// Rutele publice pentru conturi: inregistrare, confirmarea emailului, parola uitata.
// (Paginile contului unui utilizator conectat sunt in routes/cont.js.)
const express = require('express');
const { actiune } = require('../infrastructura/container'); // DI: controllerele isi primesc serviciile
const { rateLimit } = require('express-rate-limit');
const InregistrareController = require('../controllers/InregistrareController');
const ParolaUitataController = require('../controllers/ParolaUitataController');
const ContController = require('../controllers/ContController');

const router = express.Router();

// Limite impotriva abuzului (conturi false in masa, emailuri trimise la nesfarsit catre cineva).
// La depasire: pagina de eroare cu mesaj clar.
const limita = (minute, maxim) => rateLimit({
  windowMs: minute * 60 * 1000,
  limit: maxim,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => res.status(429).render('eroare', {
    titlu: 'Prea multe cereri',
    mesaj_eroare: `Ai trimis prea multe cereri într-un timp scurt. Încearcă din nou peste ${minute} de minute.`,
  }),
});
const limitaInregistrare = limita(60, 10);
const limitaEmailuri = limita(15, 5);

router.get('/inregistrare', actiune(InregistrareController, 'inregistrareGet'));
router.post('/inregistrare', limitaInregistrare, actiune(InregistrareController, 'inregistrarePost'));
router.get('/inregistrare/trimis', actiune(InregistrareController, 'trimis'));

router.get('/confirmare/retrimite', actiune(InregistrareController, 'retrimiteGet'));
router.post('/confirmare/retrimite', limitaEmailuri, actiune(InregistrareController, 'retrimitePost'));
router.get('/confirmare/:token', actiune(InregistrareController, 'confirmare'));

router.get('/parola-uitata', actiune(ParolaUitataController, 'cerereGet'));
router.post('/parola-uitata', limitaEmailuri, actiune(ParolaUitataController, 'cererePost'));
router.get('/resetare/:token', actiune(ParolaUitataController, 'resetareGet'));
router.post('/resetare/:token', limita(15, 10), actiune(ParolaUitataController, 'resetarePost'));

// Confirmarea noului email: din link, poate fi deschis si fara sa fii conectat
router.get('/cont/email/confirmare/:token', actiune(ContController, 'emailConfirmare'));

module.exports = router;
