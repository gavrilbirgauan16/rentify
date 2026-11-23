// API-ul pentru "Contul meu" (orice rol conectat): profilul, schimbarea parolei, schimbarea emailului.
// Aceleasi reguli ca paginile (servicii/cont.js + validarea din ContViewModel). Totul pentru contul DIN SESIUNE:
// nu exista niciun id in adresa, deci nimeni nu poate ajunge la contul altcuiva.
const ContViewModel = require('../../models/ContViewModel');
const { asiguraToken } = require('../../middleware/csrf');

const corp = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {});

// Ce vede utilizatorul despre contul lui (fara parola, fara amprenta ei).
const catreDto = (p) => ({
  id: p.id,
  email: p.email,
  prenume: p.prenume,
  nume: p.nume,
  telefon: p.telefon ?? null,
  oras: p.oras ?? null,
  rol: p.rol?.nume ?? null,
  email_verificat: p.email_verificat,
  creat_la: p.creat_la ? p.creat_la.toISOString() : null,
});

// Dependency Injection (laboratorul 10): controllerul e o "fabrica" - la fiecare cerere, containerul o apeleaza
// cu serviciul de care are nevoie (primit prin parametru, nu creat aici) si primeste inapoi actiunile.
module.exports = function ContApiController({ cont: cont }) {
  // GET /api/cont
  async function profil(req, res) {
    res.json(catreDto(await cont.profil(res.locals.utilizator.id)));
  }

  // PUT /api/cont  { prenume, nume, telefon, oras } - aceeasi validare ca pagina (telefon obligatoriu pentru proprietari)
  async function modificaProfil(req, res) {
    const u = res.locals.utilizator;
    const model = ContViewModel.dinProfil(corp(req), u.rol);
    const erori = model.valideazaDate();
    if (Object.keys(erori).length > 0) return res.status(400).json({ eroare: 'Date invalide.', erori });
    await cont.modificaProfil(u.id, model);
    res.json(catreDto(await cont.profil(u.id)));
  }

  // POST /api/cont/parola  { parola_curenta, parola_noua, confirmare }
  // Dupa schimbare: sesiune noua aici, celelalte sesiuni ale contului inchise. Raspunde cu tokenul CSRF NOU.
  async function schimbaParola(req, res) {
    const u = res.locals.utilizator;
    const b = corp(req);
    const { erori } = await cont.schimbaParola(u.id, b.parola_curenta, b.parola_noua, b.confirmare);
    if (erori) return res.status(400).json({ eroare: 'Date invalide.', erori });
    await cont.pastreazaDoarSesiuneaAsta(req, u.id);
    res.json({ mesaj: 'Parola a fost schimbată. Ai fost deconectat de pe celelalte dispozitive.', csrfToken: asiguraToken(req) });
  }

  // POST /api/cont/email  { email, parola_curenta } - linkul de confirmare pleaca pe adresa NOUA (202: rezultatul vine pe email)
  async function cereSchimbareaEmailului(req, res) {
    const b = corp(req);
    const { email, erori } = await cont.cereSchimbareaEmailului(res.locals.utilizator, b.email, b.parola_curenta);
    if (erori) return res.status(400).json({ eroare: 'Date invalide.', erori });
    res.status(202).json({ mesaj: `Ți-am trimis un link de confirmare pe ${email}. Adresa se schimbă după ce apeși pe el.` });
  }

  // POST /api/cont/email/confirmare  { token } - din linkul din email; merge si fara sa fii conectat
  async function confirmaEmailul(req, res) {
    res.set('Cache-Control', 'no-store');
    const { eroare, emailNou } = await cont.confirmaSchimbareaEmailului(String(corp(req).token || ''));
    if (eroare) return res.status(400).json({ eroare });
    res.json({ mesaj: `Adresa de email a fost schimbată în ${emailNou}.`, email: emailNou });
  }

  return { profil, modificaProfil, schimbaParola, cereSchimbareaEmailului, confirmaEmailul };
};
