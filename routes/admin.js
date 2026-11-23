// Toata partea de administrare, sub /admin. O singura regula le protejeaza pe toate:
// trebuie sa fii conectat SI sa ai rolul "admin".
const express = require('express');
const { cereAutentificare, cereRol } = require('../middleware/autentificare');
const PanouController = require('../controllers/PanouController');
const JurnalController = require('../controllers/JurnalController');
const CautareController = require('../controllers/CautareController');
const { actiune } = require('../infrastructura/container'); // DI: controllerele isi primesc serviciile
const proprietatiRouter = require('./proprietati');
const anunturiRouter = require('./anunturi');
const planuriRouter = require('./planuri');
const abonamenteRouter = require('./abonamente');
const utilizatoriRouter = require('./utilizatori');

const router = express.Router();

router.use(cereAutentificare, cereRol('admin'));

// Adresa paginii curente (cu filtrele ei): butoanele din liste se intorc aici dupa ce fac ceva.
router.use((req, res, next) => { res.locals.adresaCurenta = req.originalUrl; next(); });

// Cate anunturi asteapta aprobarea: apare ca numar langa "Anunturi" in meniu, pe orice pagina de admin.
// O interogare COUNT pe fiecare pagina de admin: rapida la numarul de anunturi de acum. Daca tabelul creste mult,
// se adauga un index pe anunt.stare (notat pentru mai tarziu).
router.use(async (req, res, next) => {
  res.locals.anunturiDeAprobat = await req.container.cradle.panouAdmin.deAprobat(); // serviciul, din containerul cererii
  next();
});

const sectiune = (nume) => (req, res, next) => { res.locals.sectiune = nume; next(); };

router.get('/', sectiune('panou'), actiune(PanouController, 'index'));
router.get('/jurnal', sectiune('jurnal'), actiune(JurnalController, 'index'));
router.get('/cautare', sectiune('cautare'), actiune(CautareController, 'index'));
router.use('/proprietati', proprietatiRouter);
router.use('/anunturi', anunturiRouter);
router.use('/planuri', planuriRouter);
router.use('/abonamente', abonamenteRouter);
router.use('/utilizatori', utilizatoriRouter);

module.exports = router;
