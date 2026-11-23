// "Contul meu" (/cont, orice cont conectat): datele de profil, parola si adresa de email.
//   GET/PUT /api/cont          - profilul (prenume, nume, telefon, oras)
//   POST    /api/cont/parola   - parola noua (cu parola actuala); dupa schimbare: alerta pe email, celelalte
//                                dispozitive deconectate, iar sesiunea de aici primeste un token CSRF NOU
//   POST    /api/cont/email    - adresa noua; linkul de confirmare pleaca pe adresa NOUA (pana atunci ramane cea veche)
// Cu o parola TEMPORARA (data de admin), serverul refuza orice altceva pana nu-ti alegi o parola noua:
// pagina arata atunci doar formularul de parola.
import { useState } from 'react';
import { Link } from 'react-router';
import { api, ADRESA_SERVER, seteazaTokenCsrf } from '../../api/client.js';
import { useApi } from '../../api/useApi.js';
import { useSesiune } from '../../sesiune/sesiune.js';
import { Camp, CampParola } from '../../componente/Camp.jsx';
import { dataAfisata } from '../../utile/formatare.js';

const ROLURI = { chirias: 'Chiriaș', proprietar: 'Proprietar', admin: 'Administrator' };

// O trimitere de formular: { seTrimite, mesaj, eroare, erori } + functia care o face.
function useTrimitere() {
  const [s, setS] = useState({ seTrimite: false, mesaj: null, eroare: null, erori: {} });
  async function trimite(lucru) {
    setS({ seTrimite: true, mesaj: null, eroare: null, erori: {} });
    try {
      const mesaj = await lucru();
      setS({ seTrimite: false, mesaj, eroare: null, erori: {} });
      return true;
    } catch (e) {
      const erori = e.erori ?? {};
      setS({ seTrimite: false, mesaj: null, eroare: Object.keys(erori).length ? null : e, erori });
      return false;
    }
  }
  const stergeEroarea = (camp) => setS((v) => ({ ...v, mesaj: null, erori: { ...v.erori, [camp]: undefined } }));
  return [s, trimite, stergeEroarea];
}

function Mesaje({ s }) {
  if (s.mesaj) return <div className="alerta alerta-succes" role="status">{s.mesaj}</div>;
  if (s.eroare) return <div className="alerta alerta-eroare" role="alert">{s.eroare.message}</div>;
  return null;
}

// ----- 1. Datele tale -----
function SectiuneProfil({ profil, laSalvare }) {
  const [c, setC] = useState({ prenume: profil.prenume, nume: profil.nume, telefon: profil.telefon ?? '', oras: profil.oras ?? '' });
  const [s, trimite, stergeEroarea] = useTrimitere();
  const proprietar = profil.rol === 'proprietar';
  const schimba = (camp) => (e) => { setC((v) => ({ ...v, [camp]: e.target.value })); stergeEroarea(camp); };

  const salveaza = (e) => {
    e.preventDefault();
    trimite(async () => {
      const { date } = await api.put('/cont', c);
      setC({ prenume: date.prenume, nume: date.nume, telefon: date.telefon ?? '', oras: date.oras ?? '' }); // forma salvata (ex. telefonul fara spatii)
      await laSalvare(); // numele din antet
      return 'Datele au fost salvate.';
    });
  };

  return (
    <form className="card-setari" onSubmit={salveaza} aria-labelledby="titlu-profil">
      <h2 id="titlu-profil">Datele tale</h2>
      <Mesaje s={s} />
      <div className="rand-doi">
        <Camp eticheta="Prenume" autoComplete="given-name" required value={c.prenume} onChange={schimba('prenume')} eroare={s.erori.prenume} />
        <Camp eticheta="Nume" autoComplete="family-name" required value={c.nume} onChange={schimba('nume')} eroare={s.erori.nume} />
      </div>
      <Camp eticheta={proprietar ? 'Telefon' : 'Telefon (opțional)'} type="tel" autoComplete="tel" required={proprietar}
        value={c.telefon} onChange={schimba('telefon')} eroare={s.erori.telefon}
        ajutor={proprietar ? 'Chiriașii conectați îl văd pe anunțurile tale, ca să te poată suna.' : undefined} />
      <Camp eticheta="Oraș (opțional)" autoComplete="address-level2" maxLength={50} value={c.oras} onChange={schimba('oras')} eroare={s.erori.oras} />
      <div className="actiuni-setari">
        <button className="buton buton-principal" type="submit" disabled={s.seTrimite}>{s.seTrimite ? 'Se salvează…' : 'Salvează datele'}</button>
      </div>
    </form>
  );
}

// ----- 2. Parola (si parola temporara) -----
function SectiuneParola({ temporara, laSchimbare }) {
  const GOL = { parola_curenta: '', parola_noua: '', confirmare: '' };
  const [c, setC] = useState(GOL);
  const [s, trimite, stergeEroarea] = useTrimitere();
  const schimba = (camp) => (e) => { setC((v) => ({ ...v, [camp]: e.target.value })); stergeEroarea(camp); };

  const salveaza = (e) => {
    e.preventDefault();
    trimite(async () => {
      const { date } = await api.post('/cont/parola', c);
      seteazaTokenCsrf(date.csrfToken); // sesiune noua pe server -> token CSRF nou
      setC(GOL); // parolele nu raman in memorie
      await laSchimbare();
      return `${date.mesaj} Ți-am trimis și un email de confirmare.`;
    });
  };

  return (
    <form className="card-setari" onSubmit={salveaza} aria-labelledby="titlu-parola">
      <h2 id="titlu-parola">{temporara ? 'Alege-ți o parolă nouă' : 'Parola'}</h2>
      {temporara && <p className="nota">Administratorul ți-a dat o parolă temporară. Ca să folosești contul, alege acum una pe care o știi doar tu.</p>}
      <Mesaje s={s} />
      <CampParola eticheta={temporara ? 'Parola temporară primită' : 'Parola actuală'} autoComplete="current-password" required
        value={c.parola_curenta} onChange={schimba('parola_curenta')} eroare={s.erori.parola_curenta} />
      <CampParola eticheta="Parola nouă" autoComplete="new-password" required minLength={8}
        value={c.parola_noua} onChange={schimba('parola_noua')} eroare={s.erori.parola_noua} ajutor="Cel puțin 8 caractere." />
      <CampParola eticheta="Repetă parola nouă" autoComplete="new-password" required
        value={c.confirmare} onChange={schimba('confirmare')} eroare={s.erori.confirmare} />
      <div className="actiuni-setari">
        <button className="buton buton-principal" type="submit" disabled={s.seTrimite}>{s.seTrimite ? 'Se schimbă…' : 'Schimbă parola'}</button>
        {!temporara && <Link className="link-uitat" to="/parola-uitata">Nu mai știi parola actuală?</Link>}
      </div>
      <p className="nota">După schimbare, contul e deconectat de pe celelalte dispozitive și primești un email de confirmare.</p>
    </form>
  );
}

// ----- 3. Adresa de email -----
function SectiuneEmail({ profil }) {
  const [c, setC] = useState({ email: '', parola_curenta: '' });
  const [s, trimite, stergeEroarea] = useTrimitere();
  const schimba = (camp) => (e) => { setC((v) => ({ ...v, [camp]: e.target.value })); stergeEroarea(camp); };

  const trimiteLinkul = (e) => {
    e.preventDefault();
    trimite(async () => {
      const { date } = await api.post('/cont/email', { email: c.email.trim(), parola_curenta: c.parola_curenta });
      setC({ email: '', parola_curenta: '' });
      return date.mesaj;
    });
  };

  return (
    <form className="card-setari" onSubmit={trimiteLinkul} aria-labelledby="titlu-email">
      <h2 id="titlu-email">Adresa de email</h2>
      <p className="email-curent">
        <strong>{profil.email}</strong>
        <span className={`insigna ${profil.email_verificat ? 'insigna-activ' : 'insigna-asteptare'}`}>{profil.email_verificat ? 'confirmată' : 'neconfirmată'}</span>
      </p>
      <Mesaje s={s} />
      <Camp eticheta="Adresa nouă" type="email" autoComplete="email" required value={c.email} onChange={schimba('email')} eroare={s.erori.email} />
      <CampParola eticheta="Parola actuală (pentru siguranță)" autoComplete="current-password" required
        value={c.parola_curenta} onChange={schimba('parola_curenta')} eroare={s.erori.parola_curenta} />
      <div className="actiuni-setari">
        <button className="buton buton-principal" type="submit" disabled={s.seTrimite}>{s.seTrimite ? 'Se trimite…' : 'Trimite linkul de confirmare'}</button>
      </div>
      <p className="nota">Îți trimitem un link pe adresa nouă. Până îl apeși, contul folosește adresa de acum; după schimbare te anunțăm și pe cea veche.</p>
    </form>
  );
}

export default function ContulMeu() {
  const { utilizator, reimprospateaza } = useSesiune();
  const temporara = utilizator.schimba_parola;
  // Cu parola temporara, GET /api/cont e refuzat de server: nici nu-l cerem.
  const { date: profil, eroare, reincarca } = useApi(temporara ? null : '/cont');
  // Dupa parola temporara pagina trece la vederea completa: mesajul de reusita il pastram sus.
  const [parolaAleasa, setParolaAleasa] = useState(false);
  async function dupaParolaTemporara() {
    await reimprospateaza();
    setParolaAleasa(true);
  }

  const antet = (
    <header className="zona-titlu">
      <p className="supratitlu">Contul meu</p>
      <h1>{utilizator.prenume} {utilizator.nume}</h1>
      {profil && <p className="nota">{ROLURI[profil.rol] ?? profil.rol} · cont creat pe {dataAfisata(profil.creat_la)}</p>}
    </header>
  );

  if (temporara) {
    return (
      <div className="zona">
        {antet}
        <div className="grila-setari"><SectiuneParola temporara laSchimbare={dupaParolaTemporara} /></div>
      </div>
    );
  }
  if (eroare) return <div className="zona"><div className="alerta alerta-eroare" role="alert">{eroare.message} <button className="buton buton-moale" type="button" onClick={reincarca}>Reîncearcă</button></div></div>;
  if (!profil) return <div className="zona">{antet}<div className="lista-schelet">{[1, 2].map((i) => <div key={i} className="card-schelet formular" />)}</div></div>;

  return (
    <div className="zona">
      {antet}
      {parolaAleasa && <div className="alerta alerta-succes" role="status">Parola ta nouă a fost salvată. Acum poți folosi contul normal; ți-am trimis și un email de confirmare.</div>}
      {utilizator.rol === 'admin' && (
        <p className="nota-stare">Ești administrator: panoul de administrare e aici → <a href={`${ADRESA_SERVER}/admin`}>Mergi la panou</a></p>
      )}
      <div className="grila-setari">
        <SectiuneProfil profil={profil} laSalvare={reimprospateaza} />
        <div className="coloana-setari">
          <SectiuneParola laSchimbare={reimprospateaza} />
          <SectiuneEmail profil={profil} />
        </div>
      </div>
    </div>
  );
}
