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

  // Utilizatorul cu un anumit email, cu rolul lui (la autentificare).
  async getByEmail(email) {
    return context.utilizator.findUnique({ where: { email }, include: { rol: true } });
  }

  // Datele minime ale utilizatorului conectat (la fiecare cerere). Fara parola!
  async getPentruSesiune(id) {
    return context.utilizator.findUnique({
      where: { id },
      select: { id: true, nume: true, prenume: true, email: true, stare: true, rol: { select: { nume: true } } },
    });
  }

  // Salveaza momentul ultimei autentificari.
  async inregistreazaAutentificare(id) {
    return context.utilizator.update({ where: { id }, data: { ultima_autentificare: new Date() } });
  }

  // Schimba parola (primeste amprenta deja calculata, nu parola in clar).
  async seteazaParola(id, parolaHash) {
    return context.utilizator.update({ where: { id }, data: { parola_hash: parolaHash, actualizat_la: new Date() } });
  }
}

module.exports = UtilizatorAccessor;