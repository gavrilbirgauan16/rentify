// Toata partea de administrare, sub /admin. O singura regula le protejeaza pe toate:
// trebuie sa fii conectat SI sa ai rolul "admin".
const express = require('express');
const { cereAutentificare, cereRol } = require('../middleware/autentificare');
const panou = require('../controllers/PanouController');
const jurnal = require('../controllers/JurnalController');
const cautare = require('../controllers/CautareController');
const proprietatiRouter = require('./proprietati');
const anunturiRouter = require('./anunturi');
const planuriRouter = require('./planuri');
const abonamenteRouter = require('./abonamente');
const utilizatoriRouter = require('./utilizatori');

const router = express.Router();

router.use(cereAutentificare, cereRol('admin'));

// Adresa paginii curente (cu filtrele ei): butoanele din liste se intorc aici dupa ce fac ceva.
router.use((req, res, next) => { res.locals.adresaCurenta = req.originalUrl; next(); });

const sectiune = (nume) => (req, res, next) => { res.locals.sectiune = nume; next(); };

router.get('/', sectiune('panou'), panou.index);
router.get('/jurnal', sectiune('jurnal'), jurnal.index);
router.get('/cautare', sectiune('cautare'), cautare.index);
router.use('/proprietati', proprietatiRouter);
router.use('/anunturi', anunturiRouter);
router.use('/planuri', planuriRouter);
router.use('/abonamente', abonamenteRouter);
router.use('/utilizatori', utilizatoriRouter);

module.exports = router;
