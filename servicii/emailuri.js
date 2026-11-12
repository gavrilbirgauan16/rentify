// Textele emailurilor trimise de aplicatie (simplu text + varianta HTML). Fiecare intoarce { subiect, text, html }.
const config = require('../config');

// Escapare pentru HTML (numele utilizatorului ajunge in email).
const h = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function sablon({ salut, paragrafe, buton, link, nota }) {
  const text = [salut, '', ...paragrafe, '', `${buton}: ${link}`, '', nota, '', '— Echipa Rentify'].join('\n');
  const html = `<!doctype html><html lang="ro"><body style="margin:0;padding:24px;background:#f4f6f8;font-family:Arial,sans-serif;color:#1d2a33">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;padding:28px">
    <p style="font-size:20px;font-weight:bold;color:#1f4e5f;margin:0 0 16px">Rentify</p>
    <p>${h(salut)}</p>
    ${paragrafe.map((p) => `<p>${h(p)}</p>`).join('')}
    <p style="margin:24px 0"><a href="${h(link)}" style="background:#1f4e5f;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block">${h(buton)}</a></p>
    <p style="font-size:13px;color:#5b6770">Dacă butonul nu merge, copiază adresa în browser:<br><span style="word-break:break-all">${h(link)}</span></p>
    <p style="font-size:13px;color:#5b6770">${h(nota)}</p>
  </div></body></html>`;
  return { text, html };
}

const confirmareCont = (u, token) => ({
  subiect: 'Confirmă-ți contul Rentify',
  ...sablon({
    salut: `Bună, ${u.prenume}!`,
    paragrafe: ['Mulțumim că ți-ai făcut cont pe Rentify. Mai ai un singur pas: confirmă că această adresă de email este a ta.'],
    buton: 'Confirmă contul',
    link: `${config.appUrl}/confirmare/${token}`,
    nota: 'Linkul este valabil 24 de ore. Dacă nu tu ți-ai făcut cont, ignoră acest email.',
  }),
});

const resetareParola = (u, token) => ({
  subiect: 'Resetarea parolei Rentify',
  ...sablon({
    salut: `Bună, ${u.prenume}!`,
    paragrafe: ['Am primit o cerere de resetare a parolei pentru contul tău. Apasă butonul de mai jos și alege o parolă nouă.'],
    buton: 'Alege o parolă nouă',
    link: `${config.appUrl}/resetare/${token}`,
    nota: 'Linkul este valabil o oră și merge o singură dată. Dacă nu tu ai cerut resetarea, ignoră acest email: parola ta rămâne aceeași.',
  }),
});

const schimbareEmail = (u, token) => ({
  subiect: 'Confirmă noua adresă de email Rentify',
  ...sablon({
    salut: `Bună, ${u.prenume}!`,
    paragrafe: ['Ai cerut să folosești această adresă de email pentru contul tău Rentify. Confirm-o ca să finalizezi schimbarea.'],
    buton: 'Confirmă noua adresă',
    link: `${config.appUrl}/cont/email/confirmare/${token}`,
    nota: 'Linkul este valabil 24 de ore. Până la confirmare, contul folosește în continuare adresa veche.',
  }),
});

// Anunt pe adresa VECHE dupa schimbarea emailului (daca nu a fost el, afla imediat).
const emailSchimbat = (u, emailNou) => {
  const text = [`Bună, ${u.prenume}!`, '', `Adresa de email a contului tău Rentify a fost schimbată în ${emailNou}.`, 'Dacă nu tu ai făcut schimbarea, contactează imediat administratorul.', '', '— Echipa Rentify'].join('\n');
  return { subiect: 'Adresa de email a contului Rentify a fost schimbată', text, html: `<p>${h(text).replace(/\n/g, '<br>')}</p>` };
};

// Cineva a incercat sa-si faca un cont nou cu o adresa deja inregistrata si confirmata.
// Pagina nu spune ca adresa exista (ca sa nu se poata afla cine are cont); il anuntam doar pe proprietarul adresei.
const contExistent = (u) => ({
  subiect: 'Ai deja un cont Rentify',
  ...sablon({
    salut: `Bună, ${u.prenume}!`,
    paragrafe: ['Cineva (probabil tu) a încercat să-și facă un cont nou pe Rentify cu această adresă de email. Ai deja un cont cu ea, așa că nu am creat altul.', 'Dacă nu-ți mai amintești parola, o poți reseta.'],
    buton: 'Am uitat parola',
    link: `${config.appUrl}/parola-uitata`,
    nota: 'Dacă nu tu ai încercat, ignoră acest email: contul tău nu a fost modificat.',
  }),
});

module.exports = { contExistent, confirmareCont, resetareParola, schimbareEmail, emailSchimbat };
