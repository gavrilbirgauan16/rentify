// Toata partea de administrare, sub /admin. O singura regula le protejeaza pe toate:
// trebuie sa fii conectat SI sa ai rolul "admin".
const express = require('express');
const { cereAutentificare, cereRol } = require('../middleware/autentificare');
const proprietatiRouter = require('./proprietati');
const anunturiRouter = require('./anunturi');
const planuriRouter = require('./planuri');
const abonamenteRouter = require('./abonamente');
const utilizatoriRouter = require('./utilizatori');
const router = express.Router();

router.use(cereAutentificare, cereRol('admin'));

router.get('/', (req, res) => res.redirect('/admin/proprietati'));
router.use('/proprietati', proprietatiRouter);
router.use('/anunturi', anunturiRouter);
router.use('/planuri', planuriRouter);
router.use('/abonamente', abonamenteRouter);
router.use('/utilizatori', utilizatoriRouter);
module.exports = router;