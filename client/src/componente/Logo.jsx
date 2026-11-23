// Logo-ul Rentify: semnul (o casa cu "R") + numele. Desenat in SVG (scalabil, clar la orice marime),
// cu culorile temei (variabilele CSS), deci se potriveste singur cu designul.
// marime = inaltimea semnului in pixeli; faraText = doar semnul (ex. pe telefon sau in ecranul de intrare).
export default function Logo({ marime = 36, faraText = false }) {
  return (
    <span className="logo">
      <svg className="logo-semn" width={marime} height={marime} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
        <rect width="40" height="40" rx="12" fill="var(--principal)" />
        {/* acoperisul casei, auriu */}
        <path d="M8.5 19.5 20 10l11.5 9.5" fill="none" stroke="var(--accent)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        {/* litera R: bara, bucla si piciorul */}
        <path d="M15.5 31V18.5h5.6a3.9 3.9 0 0 1 0 7.8h-5.6M20.6 26.3 25 31" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!faraText && <span className="logo-text">Rent<span>ify</span></span>}
    </span>
  );
}
