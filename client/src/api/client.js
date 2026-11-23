// Clientul API: SINGURUL loc din interfata care vorbeste cu serverul (/api). Paginile nu folosesc fetch direct.
// Se ocupa de: JSON, tokenul CSRF (protectia formularelor), mesajele de eroare si serverul oprit.
//
// Cum functioneaza CSRF aici: serverul ne da un token (GET /api/auth/csrf), legat de sesiunea noastra.
// La orice cerere care SCHIMBA ceva (POST, PUT, DELETE) il trimitem in antetul x-csrf-token. Un site strain
// nu-l poate citi, deci nu poate trimite cereri "in numele nostru".

// Eroare primita de la API, cu tot ce trebuie pentru afisare: status (401, 404...), mesaj si erorile pe campuri.
export class EroareApi extends Error {
  constructor(status, date) {
    super(date?.eroare || 'A apărut o problemă. Încearcă din nou.');
    this.name = 'EroareApi';
    this.status = status;
    this.erori = date?.erori || {}; // ex. { email: 'Emailul nu este valid.' }
  }
}

let tokenCsrf = null;

async function token() {
  if (!tokenCsrf) {
    const r = await fetch('/api/auth/csrf');
    if (!r.ok) throw new EroareApi(r.status, null);
    tokenCsrf = (await r.json()).csrfToken;
  }
  return tokenCsrf;
}

// Dupa login / logout sesiunea e alta, deci si tokenul: serverul ni-l da pe cel nou (sau il cerem din nou).
export function seteazaTokenCsrf(nou) {
  tokenCsrf = nou || null;
}

async function cerere(metoda, adresa, { body, semnal } = {}, aDouaOara = false) {
  const antete = { Accept: 'application/json' };
  if (metoda !== 'GET') antete['x-csrf-token'] = await token();
  let corp;
  if (body instanceof FormData) corp = body; // fisiere (poze): browserul pune singur tipul
  else if (body !== undefined) {
    antete['Content-Type'] = 'application/json';
    corp = JSON.stringify(body);
  }

  let r;
  try {
    r = await fetch(`/api${adresa}`, { method: metoda, headers: antete, body: corp, signal: semnal });
  } catch (e) {
    if (e.name === 'AbortError') throw e; // cererea a fost anulata de noi (ex. am parasit pagina)
    throw new EroareApi(0, { eroare: 'Nu mă pot conecta la server. Verifică internetul și încearcă din nou.' });
  }

  const text = await r.text();
  let date;
  try { date = text ? JSON.parse(text) : null; } catch { date = null; } // raspuns care nu e JSON

  // Tokenul CSRF nu mai e bun (ex. sesiunea a expirat): luam unul nou si mai incercam O SINGURA data.
  if (r.status === 403 && !aDouaOara && /CSRF/.test(date?.eroare || '')) {
    tokenCsrf = null;
    return cerere(metoda, adresa, { body, semnal }, true);
  }
  if (!r.ok) throw new EroareApi(r.status, date);
  return { date, antete: r.headers };
}

export const api = {
  get: (adresa, optiuni) => cerere('GET', adresa, optiuni),
  post: (adresa, body, optiuni) => cerere('POST', adresa, { ...optiuni, body: body ?? {} }),
  put: (adresa, body, optiuni) => cerere('PUT', adresa, { ...optiuni, body }),
  delete: (adresa, optiuni) => cerere('DELETE', adresa, optiuni),
};
