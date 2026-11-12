// Trimiterea emailurilor. Cu SMTP configurat in .env (ex. Gmail) trimite emailuri reale;
// fara SMTP (in dezvoltare) le afiseaza in consola, ca linkurile sa poata fi testate oricum.
const nodemailer = require('nodemailer');
const config = require('../config');

const transport = config.smtp
  ? nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465, // 465 = conexiune criptata de la inceput
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  })
  : null;

// trimite({ catre, subiect, text, html }). Intoarce true daca a plecat (sau a fost afisat in consola).
// Nu arunca eroare: un email care nu pleaca nu trebuie sa strice pagina; notam problema in consola.
async function trimite({ catre, subiect, text, html }) {
  if (!transport) {
    if (config.esteProductie) {
      console.error(`Email NEtrimis catre ${catre} („${subiect}”): SMTP nu este configurat.`);
      return false;
    }
    console.log(`\n===== EMAIL (doar in consola, SMTP neconfigurat) =====\nCatre: ${catre}\nSubiect: ${subiect}\n\n${text}\n======================================================\n`);
    return true;
  }
  try {
    await transport.sendMail({ from: config.smtp.de, to: catre, subject: subiect, text, html });
    return true;
  } catch (eroare) {
    console.error(`Emailul catre ${catre} nu a putut fi trimis:`, eroare.message);
    return false;
  }
}

// Verifica la pornire ca setarile SMTP sunt bune (ex. parola de aplicatie gresita). Doar afiseaza rezultatul.
async function verificaConexiunea() {
  if (!transport) {
    console.log('Email: SMTP neconfigurat, emailurile se afiseaza in consola.');
    return;
  }
  try {
    await transport.verify();
    console.log(`Email: conectat la ${config.smtp.host} ca ${config.smtp.user}.`);
  } catch (eroare) {
    console.error(`Email: nu ma pot conecta la ${config.smtp.host} (${eroare.message}). Verifica SMTP_USER si SMTP_PASS din .env.`);
  }
}

module.exports = { trimite, verificaConexiunea };
