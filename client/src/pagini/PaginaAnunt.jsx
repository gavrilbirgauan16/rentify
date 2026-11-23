// Pagina unui anunt (/anunturi/12): galeria, detaliile, cat plateste fiecare persoana si actiunile chiriasului.
//  - date:           GET  /api/anunturi/:id (doar anunturi publice; altfel 404). Fiecare deschidere numara o vizualizare.
//  - telefonul:      POST /api/anunturi/:id/contact (chirias; prima data in luna pentru un anunt consuma o contactare)
//  - favorite:       GET  /api/favorite, POST / DELETE /api/favorite/:id (chirias)
// Vizitatorul nu poate vedea telefonul: il trimitem la "Intra in cont" si apoi inapoi aici.
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { api } from '../api/client.js';
import { useApi } from '../api/useApi.js';
import Fereastra from '../componente/Fereastra.jsx';
import { useSesiune } from '../sesiune/sesiune.js';
import { pretAfisat, TIPURI_ANUNT, TIPURI_PROPRIETATE } from '../utile/formatare.js';

const dataAfisata = (text) => new Date(`${text}T12:00:00`).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });

// Galeria: poza mare + miniaturi; clic pe poza mare = fereastra cu poza pe tot ecranul (sageti, Escape).
function Galerie({ imagini, titlu }) {
  const [curenta, setCurenta] = useState(0);
  const [marita, setMarita] = useState(false);
  const n = imagini.length;
  const mergi = (pas) => setCurenta((c) => (c + pas + n) % n);

  // In fereastra marita: sagetile stanga / dreapta schimba poza.
  useEffect(() => {
    if (!marita || n < 2) return undefined;
    const laTasta = (e) => {
      if (e.key === 'ArrowRight') setCurenta((c) => (c + 1) % n);
      if (e.key === 'ArrowLeft') setCurenta((c) => (c - 1 + n) % n);
    };
    window.addEventListener('keydown', laTasta);
    return () => window.removeEventListener('keydown', laTasta);
  }, [marita, n]);

  if (n === 0) return <div className="galerie goala"><span>Proprietarul n-a adăugat încă poze.</span></div>;
  return (
    <div className="galerie">
      <button type="button" className="poza-mare" onClick={() => setMarita(true)} aria-label="Mărește poza">
        <img src={imagini[curenta]} alt={`${titlu} - poza ${curenta + 1} din ${n}`} />
        {n > 1 && <span className="numar-poza">{curenta + 1} / {n}</span>}
      </button>
      {n > 1 && (
        <ul className="miniaturi">
          {imagini.map((url, i) => (
            <li key={url}>
              <button type="button" className={i === curenta ? 'aleasa' : ''} onClick={() => setCurenta(i)} aria-label={`Poza ${i + 1}`} aria-current={i === curenta}>
                <img src={url} alt="" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Fereastra lata deschisa={marita} titlu={`${titlu} · ${curenta + 1} / ${n}`} laInchidere={() => setMarita(false)}>
        <div className="poza-marita">
          <img src={imagini[curenta]} alt={`${titlu} - poza ${curenta + 1}`} />
          {n > 1 && (
            <>
              <button type="button" className="sageata stanga" onClick={() => mergi(-1)} aria-label="Poza anterioară">‹</button>
              <button type="button" className="sageata dreapta" onClick={() => mergi(1)} aria-label="Poza următoare">›</button>
            </>
          )}
        </div>
        <div className="butoane-fereastra"><button className="buton buton-moale" type="button" onClick={() => setMarita(false)}>Închide</button></div>
      </Fereastra>
    </div>
  );
}

// Cardul din dreapta: pretul si actiunile (telefon, favorite), dupa cine priveste.
function CardContact({ anunt }) {
  const { utilizator } = useSesiune();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const chirias = utilizator?.rol === 'chirias';
  const favorite = useApi(chirias ? '/favorite' : null);
  const contactari = useApi(chirias ? '/contactari' : null);
  const [telefon, setTelefon] = useState(null); // { telefon, prenume } dupa "Arata telefonul"
  const [eroare, setEroare] = useState(null);
  const [ocupat, setOcupat] = useState(false);

  const esteFavorit = Boolean(favorite.date?.some((a) => a.id === anunt.id));
  const ramase = telefon?.contactari?.ramase ?? contactari.date?.ramase;

  async function aratiTelefonul() {
    if (!utilizator) {
      navigate('/intrare', { state: { de: pathname } }); // dupa login revine exact aici
      return;
    }
    setOcupat(true);
    setEroare(null);
    try {
      const { date } = await api.post(`/anunturi/${anunt.id}/contact`);
      setTelefon(date);
    } catch (e) {
      setEroare(e.message);
    } finally {
      setOcupat(false);
    }
  }

  async function schimbaFavorit() {
    if (!utilizator) {
      navigate('/intrare', { state: { de: pathname } });
      return;
    }
    setOcupat(true);
    setEroare(null);
    try {
      if (esteFavorit) await api.delete(`/favorite/${anunt.id}`);
      else await api.post(`/favorite/${anunt.id}`);
      favorite.reincarca();
    } catch (e) {
      setEroare(e.message);
    } finally {
      setOcupat(false);
    }
  }

  // Telefonul pentru linkul "tel:" (fara spatii): suna direct de pe telefon.
  const telLink = telefon?.telefon ? `tel:${telefon.telefon.replace(/[^\d+]/g, '')}` : null;
  const poateActiona = !utilizator || chirias; // proprietarii si adminul nu contacteaza proprietari

  return (
    <aside className="card-contact" aria-label="Preț și contact">
      <p className="pret-mare">{pretAfisat(anunt.pret, anunt.moneda)}{anunt.tip === 'inchiriere' && <small> / lună</small>}</p>
      {anunt.garantie > 0 && <p className="nota">Garanție: {pretAfisat(anunt.garantie, anunt.moneda)}</p>}
      {anunt.proprietar && <p className="proprietar">Proprietar: <strong>{anunt.proprietar}</strong></p>}

      {telefon ? (
        <a className="buton buton-principal buton-lat telefon" href={telLink}>📞 {telefon.telefon}</a>
      ) : poateActiona ? (
        <button className="buton buton-principal buton-lat" type="button" onClick={aratiTelefonul} disabled={ocupat}>
          {utilizator ? 'Arată telefonul' : 'Intră în cont ca să vezi telefonul'}
        </button>
      ) : (
        <p className="nota">Contactarea proprietarilor e pentru conturile de chiriaș.</p>
      )}
      {chirias && ramase !== undefined && ramase !== null && (
        <p className="nota">{ramase === 1 ? 'Îți mai rămâne 1 contactare' : `Îți mai rămân ${ramase} contactări`} luna aceasta (același anunț nu se numără de două ori).</p>
      )}

      {poateActiona && (
        <button className={`buton buton-moale buton-lat favorit-buton${esteFavorit ? ' salvat' : ''}`} type="button" onClick={schimbaFavorit}
          disabled={ocupat || (chirias && !favorite.date)} aria-pressed={esteFavorit}>
          {esteFavorit ? '♥ Salvat la favorite' : '♡ Salvează la favorite'}
        </button>
      )}
      {eroare && <p className="eroare-separata" role="alert">{eroare}</p>}
    </aside>
  );
}

export default function PaginaAnunt() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { date: a, eroare } = useApi(`/anunturi/${id}`);

  if (eroare) {
    return (
      <section className="pagina-mesaj">
        <p className="cod">{eroare.status === 404 ? '404' : 'Oops'}</p>
        <h1>{eroare.status === 404 ? 'Anunțul nu mai este disponibil' : 'Nu am putut încărca anunțul'}</h1>
        <p>{eroare.status === 404 ? 'Poate a fost închiriat între timp sau proprietarul l-a scos de pe site.' : eroare.message}</p>
        <Link className="buton buton-principal" to="/cautare">Vezi alte locuințe</Link>
      </section>
    );
  }
  if (!a) return <div className="pagina-anunt"><div className="card-schelet formular" /></div>;

  const p = a.proprietate;
  const detalii = [
    TIPURI_PROPRIETATE[p.tip] ?? p.tip,
    p.nr_camere && `${p.nr_camere} ${p.nr_camere === 1 ? 'cameră' : 'camere'}`,
    p.suprafata_mp && `${p.suprafata_mp} m²`,
    `până la ${p.max_locatari} ${p.max_locatari === 1 ? 'persoană' : 'persoane'}`,
    p.are_balcon && 'balcon',
    a.locuri_libere > 0 && `${a.locuri_libere} ${a.locuri_libere === 1 ? 'loc liber' : 'locuri libere'}`,
  ].filter(Boolean);

  return (
    <article className="pagina-anunt">
      {/* inapoi la rezultate (pastreaza filtrele si pagina), sau la cautare daca s-a venit direct pe link */}
      <button className="inapoi buton-text-simplu" type="button" onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/cautare'))}>
        ← Înapoi la rezultate
      </button>

      <header className="cap-anunt">
        <div>
          <p className="supratitlu">{TIPURI_ANUNT[a.tip]} · {p.oras}{p.zona ? `, ${p.zona}` : ''}</p>
          <h1>{a.titlu}</h1>
        </div>
        {a.promovat && <span className="insigna insigna-promovat">★ Promovat</span>}
      </header>

      <div className="anunt-grila">
        <div className="anunt-continut">
          <Galerie imagini={a.imagini} titlu={a.titlu} />

          <ul className="caracteristici mari">{detalii.map((d) => <li key={d}>{d}</li>)}</ul>

          {a.descriere && (
            <section className="sectiune-anunt">
              <h2>Despre locuință</h2>
              <p className="descriere">{a.descriere}</p>
            </section>
          )}

          {a.preturi_pe_persoane.length > 1 && (
            <section className="sectiune-anunt">
              <h2>Cât plătește fiecare</h2>
              <p className="nota">Chiria se împarte egal între cei care locuiesc împreună.</p>
              <table className="tabel-preturi">
                <thead><tr><th scope="col">Persoane</th><th scope="col">Fiecare plătește</th><th scope="col">Total pe lună</th></tr></thead>
                <tbody>
                  {a.preturi_pe_persoane.map((r) => (
                    <tr key={r.persoane}>
                      <th scope="row">{r.persoane}</th>
                      <td>{pretAfisat(r.pe_persoana, a.moneda)}</td>
                      <td>{pretAfisat(r.total, a.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <p className="nota meta-anunt">
            {a.disponibil_de_la && <>Disponibil de la {dataAfisata(a.disponibil_de_la)} · </>}
            {a.vizualizari} {a.vizualizari === 1 ? 'vizualizare' : 'vizualizări'}
          </p>
        </div>

        <CardContact anunt={a} />
      </div>
    </article>
  );
}
