// Rutele publice pentru conturi: inregistrare, confirmarea emailului, parola uitata.
// (Paginile contului unui utilizator conectat sunt in routes/cont.js.)
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const inregistrare = require('../controllers/InregistrareController');
const parolaUitata = require('../controllers/ParolaUitataController');
const cont = require('../controllers/ContController');

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

router.get('/inregistrare', inregistrare.inregistrareGet);
router.post('/inregistrare', limitaInregistrare, inregistrare.inregistrarePost);
router.get('/inregistrare/trimis', inregistrare.trimis);

router.get('/confirmare/retrimite', inregistrare.retrimiteGet);
router.post('/confirmare/retrimite', limitaEmailuri, inregistrare.retrimitePost);
router.get('/confirmare/:token', inregistrare.confirmare);

router.get('/parola-uitata', parolaUitata.cerereGet);
router.post('/parola-uitata', limitaEmailuri, parolaUitata.cererePost);
router.get('/resetare/:token', parolaUitata.resetareGet);
router.post('/resetare/:token', limita(15, 10), parolaUitata.resetarePost);

// Confirmarea noului email: din link, poate fi deschis si fara sa fii conectat
router.get('/cont/email/confirmare/:token', cont.emailConfirmare);

module.exports = router;
