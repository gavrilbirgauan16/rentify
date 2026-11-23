// Metode de acces la date pentru tokenurile din linkurile trimise pe email (tabelul token_cont).
// Conexiunea la baza de date NU mai e luata direct de aici: o primeste constructorul (Dependency Injection,
// laboratorul 10), de la containerul din infrastructura/container.js.

class TokenAccessor {
  // Dependinta primita prin constructor: contextul Prisma (echivalentul DbContext din Entity Framework).
  constructor({ context }) {
    this.context = context;
  }

  // Token nou. Tokenurile nefolosite de acelasi tip ale utilizatorului se anuleaza:
  // merge doar ultimul link trimis (ex. daca cere de doua ori resetarea parolei).
  async creeaza({ utilizatorId, tip, hash, expiraLa, emailNou = null }) {
    return this.context.$transaction([
      this.context.token_cont.updateMany({ where: { utilizator_id: utilizatorId, tip, folosit_la: null }, data: { folosit_la: new Date() } }),
      this.context.token_cont.create({ data: { utilizator_id: utilizatorId, tip, hash_token: hash, expira_la: expiraLa, email_nou: emailNou } }),
    ]);
  }

  // Tokenul valid (nefolosit, neexpirat) cu amprenta data, cu utilizatorul lui. Null daca nu exista.
  async getValid(hash, tip) {
    return this.context.token_cont.findFirst({
      where: { hash_token: hash, tip, folosit_la: null, expira_la: { gt: new Date() } },
      include: { utilizator: { select: { id: true, email: true, nume: true, prenume: true, stare: true, rol: { select: { nume: true } } } } },
    });
  }

  // Marcheaza tokenul ca folosit. Intoarce true doar pentru prima folosire (doua clicuri simultane nu trec amandoua).
  async marcheazaFolosit(id) {
    const r = await this.context.token_cont.updateMany({ where: { id, folosit_la: null }, data: { folosit_la: new Date() } });
    return r.count === 1;
  }
}

module.exports = TokenAccessor;
