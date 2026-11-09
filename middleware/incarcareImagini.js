// Primeste imaginile trimise din formularul de anunt si le salveaza in folderul uploads/anunturi.
// Foloseste pachetul multer. Erorile (fisier prea mare, tip gresit) nu opresc aplicatia:
// ajung in req.eroareImagini si apar ca mesaj rosu sub campul de imagini.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { tokenValid, refuza } = require('./csrf');

const FOLDER = path.join(__dirname, '..', 'uploads', 'anunturi');
const TIPURI_PERMISE = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const MAX_IMAGINI = 6;
const MAX_MB = 5;

fs.mkdirSync(FOLDER, { recursive: true }); // creeaza folderul daca nu exista

const incarcare = multer({
  storage: multer.diskStorage({
    destination: FOLDER,
    // Nume nou, aleator: nu se suprascriu fisiere si nu folosim numele trimis de utilizator.
    filename: (req, fisier, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${TIPURI_PERMISE[fisier.mimetype]}`),
  }),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: MAX_IMAGINI },
  fileFilter: (req, fisier, cb) => {
    if (TIPURI_PERMISE[fisier.mimetype]) return cb(null, true);
    return cb(new multer.MulterError('TIP_GRESIT', fisier.fieldname));
  },
}).array('imagini', MAX_IMAGINI);

const MESAJE = {
  LIMIT_FILE_SIZE: `O imagine poate avea cel mult ${MAX_MB} MB.`,
  LIMIT_FILE_COUNT: `Poți încărca cel mult ${MAX_IMAGINI} imagini.`,
  LIMIT_UNEXPECTED_FILE: `Poți încărca cel mult ${MAX_IMAGINI} imagini.`,
  TIP_GRESIT: 'Sunt acceptate doar imagini JPG, PNG sau WEBP.',
};

// Browserul spune ce tip are fisierul, dar asta se poate falsifica (ex. un .exe redenumit in .jpg).
// De aceea citim primii octeti ai fisierului ("semnatura") si verificam ca e chiar o imagine.
function esteImagineReala(caleFisier, tip) {
  const cap = Buffer.alloc(12);
  const fd = fs.openSync(caleFisier, 'r');
  try {
    fs.readSync(fd, cap, 0, 12, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (tip === 'image/jpeg') return cap[0] === 0xff && cap[1] === 0xd8 && cap[2] === 0xff;
  if (tip === 'image/png') return cap.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (tip === 'image/webp') return cap.toString('ascii', 0, 4) === 'RIFF' && cap.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

// Sterge de pe disc fisierele date (ex. cand formularul are erori si anuntul nu se salveaza).
function stergeFisiere(caiWeb) {
  for (const cale of caiWeb) {
    fs.unlink(path.join(__dirname, '..', cale), () => {}); // daca fisierul nu mai exista, nu e o problema
  }
}

const caiWebDin = (fisiere) => fisiere.map((f) => `/uploads/anunturi/${f.filename}`);

// Middleware-ul folosit in rute, inaintea actiunilor create si edit.
function incarcaImagini(req, res, next) {
  incarcare(req, res, (eroare) => {
    req.files = req.files || [];

    // Abia acum (dupa ce multer a citit formularul) putem verifica tokenul CSRF.
    if (!tokenValid(req)) {
      stergeFisiere(caiWebDin(req.files));
      return refuza(res);
    }

    if (!eroare && req.files.some((f) => !esteImagineReala(f.path, f.mimetype))) {
      eroare = { code: 'TIP_GRESIT' };
    }
    if (eroare) {
      req.eroareImagini = MESAJE[eroare.code] || 'Imaginile nu au putut fi încărcate.';
      stergeFisiere(caiWebDin(req.files));
      req.files = [];
    }
    next();
  });
}

module.exports = { incarcaImagini, stergeFisiere, MAX_IMAGINI, MAX_MB };