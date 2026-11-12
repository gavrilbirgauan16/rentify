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
  async cauta({ rol, stare, cautare } = {}, orderBy = [{ nume: 'asc' }, { prenume: 'asc' }]) {
    const where = {};
    if (rol) where.rol = { nume: rol };
    if (stare) where.stare = stare;
    if (cautare) where.OR = ['nume', 'prenume', 'email', 'telefon'].map((camp) => ({ [camp]: { contains: cautare, mode: 'insensitive' } }));
    return context.utilizator.findMany({
      where,
      omit: { parola_hash: true },
      include: { rol: { select: { nume: true } }, _count: { select: { proprietate: { where: { NOT: { stare: 'inactiv' } } } } } },
      orderBy,
    });
  }

  // Cati utilizatori are fiecare rol si cati sunt blocati (pentru panou).
  async statistici() {
    const [peRol, blocati] = await Promise.all([
      context.rol.findMany({ select: { nume: true, _count: { select: { utilizator: true } } } }),
      context.utilizator.count({ where: { stare: 'blocat' } }),
    ]);
    return { peRol: Object.fromEntries(peRol.map((r) => [r.nume, r._count.utilizator])), blocati };
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

  // ---- Conturi (inregistrare, confirmare, profil) ----

  // true daca emailul e deja folosit de alt cont (exceptId = contul curent, la schimbarea emailului).
  async emailFolosit(email, exceptId = null) {
    const u = await context.utilizator.findUnique({ where: { email }, select: { id: true } });
    return Boolean(u) && u.id !== exceptId;
  }

  // Cont nou (neconfirmat). Rolul se leaga dupa nume ('proprietar' / 'chirias').
  async creeazaCont(numeRol, date, parolaHash) {
    return context.utilizator.create({
      data: { ...date, parola_hash: parolaHash, rol: { connect: { nume: numeRol } } },
      select: { id: true, email: true, prenume: true, nume: true },
    });
  }

  // Confirma emailul. Optional, in aceeasi tranzactie, primul abonament (planul gratuit al chiriasului),
  // doar daca utilizatorul nu are inca niciun abonament (ex. linkul deschis de doua ori).
  async confirmaEmail(id, abonamentInitial = null) {
    return context.$transaction(async (tx) => {
      await tx.utilizator.update({ where: { id }, data: { email_verificat: true, actualizat_la: new Date() } });
      if (abonamentInitial && (await tx.abonament.count({ where: { utilizator_id: id } })) === 0) {
        await tx.abonament.create({ data: { ...abonamentInitial, utilizator_id: id } });
      }
    });
  }

  // Parola noua aleasa din linkul de resetare: daca a primit linkul pe email, emailul e confirmat,
  // iar o eventuala parola temporara de la admin nu mai e valabila.
  async reseteazaParola(id, parolaHash) {
    return context.utilizator.update({
      where: { id },
      data: { parola_hash: parolaHash, schimba_parola: false, email_verificat: true, actualizat_la: new Date() },
    });
  }

  // Datele pentru pagina "Contul meu" (fara parola).
  async getProfil(id) {
    return context.utilizator.findUnique({
      where: { id },
      select: { id: true, email: true, prenume: true, nume: true, telefon: true, oras: true, creat_la: true, email_verificat: true, rol: { select: { nume: true } } },
    });
  }

  async actualizeazaProfil(id, date) {
    return context.utilizator.update({ where: { id }, data: { ...date, actualizat_la: new Date() } });
  }

  async schimbaEmail(id, email) {
    return context.utilizator.update({ where: { id }, data: { email, email_verificat: true, actualizat_la: new Date() } });
  }
}

module.exports = UtilizatorAccessor;