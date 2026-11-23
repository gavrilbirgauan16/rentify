// Intrarea in cont si crearea contului, pe un singur card care se intoarce (3D):
//   /intrare      -> fata:   "Intra in cont"   (POST /api/auth/login)
//   /inregistrare -> spatele: "Creeaza cont"    (POST /api/auth/inregistrare, apoi confirmarea din email)
// Partea vizibila vine din ADRESA, deci "Inapoi" din browser intoarce cardul, iar linkurile duc direct la o parte.
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { api, ADRESA_SERVER } from '../api/client.js';
import { useSesiune } from '../sesiune/sesiune.js';
import { Camp, CampParola } from '../componente/Camp.jsx';

const ROLURI = {
  chirias: { nume: 'Chiriaș', iconita: '🔑', text: 'Cauți o locuință: salvezi anunțuri la favorite și contactezi proprietarii.' },
  proprietar: { nume: 'Proprietar', iconita: '🏠', text: 'Ai o locuință de închiriat: publici anunțuri și îți urmărești proprietățile.' },
};

// Unde ajunge fiecare dupa login (daca nu venea de la o anumita pagina): proprietarul la anunturile lui.
function paginaDeStart(u) {
  return u.rol === 'proprietar' ? '/proprietar/anunturi' : '/';
}

// Paginile care nu sunt (inca) in React: panoul adminului si schimbarea parolei temporare.
function mergiPeServer(cale) {
  window.location.assign(`${ADRESA_SERVER}${cale}`);
}

// Retrimiterea linkului de confirmare (raspunsul e acelasi oricare ar fi emailul: nu dezvaluim cine are cont).
function RetrimiteConfirmarea({ email }) {
  const [mesaj, setMesaj] = useState(null);
  const [seTrimite, setSeTrimite] = useState(false);
  async function retrimite() {
    setSeTrimite(true);
    try {
      const { date } = await api.post('/auth/confirmare/retrimite', { email });
      setMesaj(date.mesaj);
    } catch (e) {
      setMesaj(e.message);
    } finally {
      setSeTrimite(false);
    }
  }
  return mesaj
    ? <p className="nota" role="status">{mesaj}</p>
    : <button className="buton buton-moale buton-lat" type="button" onClick={retrimite} disabled={seTrimite}>{seTrimite ? 'Se trimite…' : 'Trimite din nou linkul de confirmare'}</button>;
}

function FormularIntrare({ ascuns, laSchimbare, destinatie, mesaj }) {
  const { conecteaza } = useSesiune();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [parola, setParola] = useState('');
  const [eroare, setEroare] = useState(null);
  const [seTrimite, setSeTrimite] = useState(false);

  async function trimite(e) {
    e.preventDefault();
    setEroare(null);
    setSeTrimite(true);
    try {
      const u = await conecteaza(email.trim(), parola);
      if (u.schimba_parola) mergiPeServer('/cont/parola'); // parola temporara: intai alege una noua
      else if (u.rol === 'admin') mergiPeServer('/admin'); // panoul adminului ramane (deocamdata) pe server
      else navigate(destinatie || paginaDeStart(u), { replace: true });
    } catch (err) {
      setEroare(err);
      setSeTrimite(false);
    }
  }

  return (
    <form className="fata" inert={ascuns} onSubmit={trimite}>
      <div className="titlu-card"><h1>Bine ai revenit</h1><p>Intră în contul tău Rentify.</p></div>
      {/* ex. dupa resetarea parolei: "Parola a fost schimbata. Conecteaza-te cu parola noua." */}
      {mesaj && !eroare && <div className="alerta alerta-succes" role="status">{mesaj}</div>}
      {eroare && (
        <div className="alerta alerta-eroare" role="alert">
          <span>{eroare.message}</span>
          {/* contul exista dar emailul nu e confirmat: oferim un link nou */}
          {eroare.date.neconfirmat && <RetrimiteConfirmarea email={email.trim()} />}
        </div>
      )}
      <Camp eticheta="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (nume@exemplu.ro)" />
      <CampParola eticheta="Parolă" autoComplete="current-password" required value={parola} onChange={(e) => setParola(e.target.value)} placeholder="Parola" />
      {/* emailul deja scris merge mai departe, ca sa nu-l scrie a doua oara */}
      <Link className="link-uitat" to="/parola-uitata" state={{ email: email.trim() }}>Ai uitat parola?</Link>
      <button className="buton buton-principal buton-lat" type="submit" disabled={seTrimite}>{seTrimite ? 'Se verifică…' : 'Intră în cont'}</button>
      <p className="schimba">Nu ai cont? <button type="button" onClick={laSchimbare}>Creează unul</button></p>
    </form>
  );
}

const GOL = { rol: 'chirias', prenume: '', nume: '', email: '', telefon: '', parola: '', confirmare: '', termeni: false };
// Campurile primului pas: daca serverul gaseste o greseala la unul dintre ele, ne intoarcem la pasul 1.
const CAMPURI_PAS_1 = ['rol', 'prenume', 'nume', 'email', 'telefon'];

// Crearea contului, in 2 PASI (formular scurt, incape pe orice ecran fara derulare):
//   pasul 1 - cine esti: rolul, numele, emailul, telefonul
//   pasul 2 - siguranta: parola si acordul pentru termeni
// Serverul primeste totul o singura data, la final (POST /api/auth/inregistrare) si verifica TOT din nou.
function FormularCreare({ ascuns, laSchimbare }) {
  const [c, setC] = useState(GOL); // campurile (raman cand treci de la un pas la altul)
  const [pas, setPas] = useState(1);
  const [erori, setErori] = useState({});
  const [eroare, setEroare] = useState(null); // eroarea generala (ex. prea multe incercari)
  const [seTrimite, setSeTrimite] = useState(false);
  const [trimisLa, setTrimisLa] = useState(null); // emailul la care s-a trimis linkul (= contul e creat)

  // Rotatia cardului (la schimbarea rolului si intre pasi). Clasa "se-invarte" se scoate dupa un timp FIX,
  // nu la sfarsitul animatiei: daca animatiile sunt oprite (setare Windows), evenimentul de sfarsit nu vine.
  const [seInvarte, setSeInvarte] = useState(false);
  const temporizator = useRef(null);
  useEffect(() => () => clearTimeout(temporizator.current), []); // la iesirea din pagina: oprim temporizatorul
  function invarte() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setSeInvarte(true);
    clearTimeout(temporizator.current);
    temporizator.current = setTimeout(() => setSeInvarte(false), 900); // putin dupa animatie (0,8 s)
  }

  function alegeRolul(cheie) {
    if (c.rol === cheie) return;
    setC((v) => ({ ...v, rol: cheie }));
    invarte();
  }
  function mergiLaPasul(nr) {
    setPas(nr);
    invarte();
  }

  // la fiecare tasta: noua valoare + stergem eroarea acelui camp (a corectat-o)
  const schimba = (camp) => (e) => {
    const valoare = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setC((v) => ({ ...v, [camp]: valoare }));
    setErori((er) => ({ ...er, [camp]: undefined }));
  };

  async function trimite(e) {
    e.preventDefault();
    // Pasul 1: browserul a verificat deja campurile obligatorii si emailul (HTML5: required, type="email").
    if (pas === 1) {
      mergiLaPasul(2);
      return;
    }
    setEroare(null);
    setSeTrimite(true);
    try {
      await api.post('/auth/inregistrare', { ...c, email: c.email.trim() });
      setTrimisLa(c.email.trim());
      setC(GOL); // parola nu ramane in memorie
      setPas(1);
    } catch (err) {
      setErori(err.erori);
      if (Object.keys(err.erori).length === 0) setEroare(err);
      // o greseala la nume / email / telefon -> inapoi la pasul 1, unde e campul cu problema
      else if (Object.keys(err.erori).some((k) => CAMPURI_PAS_1.includes(k))) mergiLaPasul(1);
    } finally {
      setSeTrimite(false);
    }
  }

  if (trimisLa) {
    return (
      <div className="fata spate" inert={ascuns}>
        <div className="titlu-card">
          <div className="iconita-mare" aria-hidden="true">✉️</div>
          <h1>Verifică-ți emailul</h1>
          <p>Ți-am trimis un link de confirmare la <strong>{trimisLa}</strong>. Deschide-l ca să-ți activezi contul (e valabil 24 de ore). Verifică și folderul Spam.</p>
        </div>
        <RetrimiteConfirmarea email={trimisLa} />
        <p className="schimba">Ai confirmat? <button type="button" onClick={() => { setTrimisLa(null); laSchimbare(); }}>Intră în cont</button></p>
      </div>
    );
  }

  const rol = ROLURI[c.rol];
  return (
    // Cand cardul e intors pe partea de login (ascuns), rotatia nu mai are voie sa ruleze.
    <form className={`fata spate${seInvarte && !ascuns ? ' se-invarte' : ''}`} inert={ascuns} onSubmit={trimite}>
      <div className="titlu-card">
        <h1>Creează cont</h1>
        {/* progresul: doua liniute; cele parcurse sunt aurii */}
        <div className="pasi">
          <span className="facut" /><span className={pas === 2 ? 'facut' : ''} />
          <small>Pasul {pas} din 2 · {pas === 1 ? 'despre tine' : 'parola'}</small>
        </div>
      </div>
      {eroare && <div className="alerta alerta-eroare" role="alert">{eroare.message}</div>}

      {pas === 1 ? (
        <>
          <div className="comutator" role="radiogroup" aria-label="Tipul contului" data-ales={c.rol}>
            <span className="glisor" aria-hidden="true" />
            {Object.entries(ROLURI).map(([cheie, r]) => (
              <button key={cheie} type="button" role="radio" aria-checked={c.rol === cheie} onClick={() => alegeRolul(cheie)}>
                <span className="iconita-rol" aria-hidden="true">{r.iconita}</span>{r.nume}
              </button>
            ))}
          </div>
          {/* descrierea rolului (pe ecran jos se ascunde, ca sa incapa formularul fara derulare) */}
          <div className="rol-ales">
            {/* key={c.rol}: la fiecare schimbare React face un element nou, deci animatia de rotire porneste din nou */}
            <span className="iconita" key={c.rol} aria-hidden="true">{rol.iconita}</span>
            <p>{rol.text}</p>
          </div>
          <div className="rand-doi">
            <Camp eticheta="Prenume" autoComplete="given-name" required value={c.prenume} onChange={schimba('prenume')} eroare={erori.prenume} placeholder="Prenume" />
            <Camp eticheta="Nume" autoComplete="family-name" required value={c.nume} onChange={schimba('nume')} eroare={erori.nume} placeholder="Nume" />
          </div>
          <Camp eticheta="Email" type="email" autoComplete="email" required value={c.email} onChange={schimba('email')} eroare={erori.email} placeholder="Email (nume@exemplu.ro)" />
          <Camp eticheta={c.rol === 'proprietar' ? 'Telefon' : 'Telefon (opțional)'} type="tel" autoComplete="tel" required={c.rol === 'proprietar'}
            value={c.telefon} onChange={schimba('telefon')} eroare={erori.telefon} placeholder={c.rol === 'proprietar' ? 'Telefon (07xx xxx xxx)' : 'Telefon, opțional (07xx xxx xxx)'}
            ajutor={c.rol === 'proprietar' ? 'Chiriașii te pot suna doar după ce își fac cont.' : undefined} />
          <button className="buton buton-principal buton-lat" type="submit">Continuă →</button>
        </>
      ) : (
        <>
          <p className="rezumat-pas">{rol.iconita} Cont de <strong>{rol.nume.toLowerCase()}</strong> pentru <strong>{c.email.trim()}</strong></p>
          <CampParola eticheta="Parolă" autoComplete="new-password" required minLength={8} value={c.parola} onChange={schimba('parola')} eroare={erori.parola} placeholder="Parolă (min. 8 caractere)" />
          <CampParola eticheta="Repetă parola" autoComplete="new-password" required value={c.confirmare} onChange={schimba('confirmare')} eroare={erori.confirmare} placeholder="Repetă parola" />
          <label className={`bifa${erori.termeni ? ' cu-eroare' : ''}`}>
            <input type="checkbox" checked={c.termeni} onChange={schimba('termeni')} required />
            <span>Accept termenii de utilizare și prelucrarea datelor mele personale.</span>
          </label>
          {erori.termeni && <span className="eroare-separata">{erori.termeni}</span>}
          <div className="rand-butoane">
            <button className="buton buton-moale" type="button" onClick={() => mergiLaPasul(1)}>← Înapoi</button>
            <button className="buton buton-principal" type="submit" disabled={seTrimite}>
              {seTrimite ? 'Se creează…' : 'Creează contul'}
            </button>
          </div>
        </>
      )}
      <p className="schimba">Ai deja cont? <button type="button" onClick={laSchimbare}>Intră în cont</button></p>
    </form>
  );
}

export default function PaginaCont() {
  const { utilizator } = useSesiune();
  const { pathname, state } = useLocation();
  const navigate = useNavigate();
  const intors = pathname === '/inregistrare';
  const card = useRef(null);

  // "Se intoarce": cat dureaza animatia de intoarcere (0,75 s), ambele fete au inaltimea lor intreaga.
  // Cand adresa (deci partea vizibila) se schimba, aflam asta chiar in timpul desenarii - modelul recomandat
  // de React pentru "o stare care depinde de o valoare anterioara", fara un efect in plus.
  const [intorsAnterior, setIntorsAnterior] = useState(intors);
  const [seIntoarce, setSeIntoarce] = useState(false);
  if (intors !== intorsAnterior) {
    setIntorsAnterior(intors);
    setSeIntoarce(true);
  }
  useEffect(() => {
    if (!seIntoarce) return undefined;
    const t = setTimeout(() => setSeIntoarce(false), 800);
    return () => clearTimeout(t);
  }, [seIntoarce, intors]);

  // Dupa ce cardul s-a intors, mutam focusul in primul camp al partii vizibile (tastatura, cititor de ecran).
  useEffect(() => {
    const t = setTimeout(() => {
      card.current?.querySelector(`.fata${intors ? '.spate' : ':not(.spate)'} input:not([type=checkbox])`)?.focus({ preventScroll: true });
    }, 350);
    return () => clearTimeout(t);
  }, [intors]);

  // Deja conectat: nu mai are ce cauta aici.
  if (utilizator) {
    if (utilizator.rol === 'admin') {
      return <section className="pagina-mesaj"><h1>Ești conectat ca administrator</h1><a className="buton buton-principal" href={`${ADRESA_SERVER}/admin`}>Mergi la panoul de administrare</a></section>;
    }
    return <Navigate to={state?.de || paginaDeStart(utilizator)} replace />;
  }

  // la intoarcerea cardului pastram doar unde voia sa ajunga (nu si mesajul verde, care era pentru intrare)
  const schimba = () => navigate(intors ? '/intrare' : '/inregistrare', { state: state?.de ? { de: state.de } : null });

  return (
    <div className="pagina-cont">
      <section className="cont-text">
        <h2>{intors ? <>Începe pe <em>Rentify</em></> : <>Bine ai venit <em>înapoi</em></>}</h2>
        <ul className="avantaje">
          <li><strong>Chiriași:</strong> salvezi locuințele care îți plac și vezi telefonul proprietarului.</li>
          <li><strong>Proprietari:</strong> publici anunțuri cu poze și îți urmărești proprietățile.</li>
          <li><strong>Fără comisioane:</strong> vorbești direct cu cealaltă parte.</li>
        </ul>
        <p className="nota"><Link to="/">← Înapoi la căutare</Link></p>
      </section>
      <div className="card-cont" ref={card}>
        <div className={`interior${intors ? ' intors' : ''}${seIntoarce ? ' se-intoarce' : ''}`}>
          <FormularIntrare ascuns={intors} laSchimbare={schimba} destinatie={state?.de} mesaj={state?.mesaj} />
          <FormularCreare ascuns={!intors} laSchimbare={schimba} />
        </div>
      </div>
    </div>
  );
}
