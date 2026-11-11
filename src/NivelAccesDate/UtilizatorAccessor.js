// Metode de acces la date pentru modelul "utilizator".
const context = require('../Repository_CodeFirst/context');

class UtilizatorAccessor {
  // Toti utilizatorii, cu numele rolului (fara amprenta parolei: nu are ce cauta in afara login-ului).
  async getAll() {
    return context.utilizator.findMany({
      omit: { parola_hash: true },
      include: { rol: true },
      orderBy: { id: 'asc' },
    });
  }

  // Utilizatorii cu un anumit rol (admin, proprietar, chirias), doar campurile pentru liste.
  async getByRol(numeRol) {
    return context.utilizator.findMany({
      where: { rol: { nume: numeRol } },
      select: { id: true, nume: true, prenume: true, email: true },
      orderBy: { nume: 'asc' },
    });
  }

  // Lista cu filtre: rol, stare ('activ'/'blocat') si cautare (nume, prenume, email, telefon).
  // Aducem si cate proprietati active are fiecare (pentru limita din plan). Fara parola!
  async cauta({ rol, stare, cautare } = {}) {
    const where = {};
    if (rol) where.rol = { nume: rol };
    if (stare) where.stare = stare;
    if (cautare) where.OR = ['nume', 'prenume', 'email', 'telefon'].map((camp) => ({ [camp]: { contains: cautare, mode: 'insensitive' } }));
    return context.utilizator.findMany({
      where,
      omit: { parola_hash: true },
      include: { rol: { select: { nume: true } }, _count: { select: { proprietate: { where: { NOT: { stare: 'inactiv' } } } } } },
      orderBy: [{ nume: 'asc' }, { prenume: 'asc' }],
    });
  }

  // Utilizatorul cu un anumit email, cu rolul lui (la autentificare).
  async getByEmail(email) {
    return context.utilizator.findUnique({ where: { email }, include: { rol: true } });
  }

  // Datele minime ale utilizatorului conectat (la fiecare cerere). Fara parola!
  async getPentruSesiune(id) {
    return context.utilizator.findUnique({
      where: { id },
      select: { id: true, nume: true, prenume: true, email: true, stare: true, schimba_parola: true, rol: { select: { nume: true } } },
    });
  }

  // Salveaza momentul ultimei autentificari.
  async inregistreazaAutentificare(id) {
    return context.utilizator.update({ where: { id }, data: { ultima_autentificare: new Date() } });
  }

  // Un utilizator cu detaliile pentru pagina lui din admin: rolul si proprietatile (fara parola!).
  async getDetalii(id) {
    return context.utilizator.findUnique({
      where: { id },
      omit: { parola_hash: true },
      include: {
        rol: { select: { nume: true } },
        proprietate: { select: { id: true, denumire: true, oras: true, stare: true }, orderBy: { denumire: 'asc' } },
        _count: { select: { proprietate: { where: { NOT: { stare: 'inactiv' } } } } },
      },
    });
  }

  // Doar amprenta parolei, pentru verificarea parolei curente la schimbare.
  async getParolaHash(id) {
    const u = await context.utilizator.findUnique({ where: { id }, select: { parola_hash: true } });
    return u?.parola_hash ?? null;
  }

  // Schimba parola (primeste amprenta deja calculata, nu parola in clar).
  // temporara = true: parola data de admin la resetare; utilizatorul e obligat s-o schimbe la conectare.
  async seteazaParola(id, parolaHash, { temporara = false } = {}) {
    return context.utilizator.update({
      where: { id },
      data: { parola_hash: parolaHash, schimba_parola: temporara, actualizat_la: new Date() },
    });
  }

  // Blocheaza / deblocheaza un cont ('blocat' / 'activ').
  async schimbaStare(id, stare) {
    return context.utilizator.update({ where: { id }, data: { stare, actualizat_la: new Date() } });
  }

  // Inchide sesiunile deschise ale unui utilizator (ex. dupa schimbarea sau resetarea parolei),
  // in afara de cea pastrata (sesiunea curenta). Sesiunile stau in tabelul "sesiune" (connect-pg-simple).
  async inchideSesiunile(id, pastreazaSid = '') {
    return context.$executeRaw`DELETE FROM "sesiune" WHERE "sess"->>'utilizatorId' = ${String(id)} AND "sid" <> ${pastreazaSid}`;
  }
}

module.exports = UtilizatorAccessor;