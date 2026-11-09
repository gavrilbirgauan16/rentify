// Protectia API-ului cu o cheie secreta (API key), trimisa de client in antetul "x-api-key".
// Citirea anunturilor active e publica; adaugarea si modificarea (Post / Put) cer cheia.
// Cheia sta in .env (API_KEY), niciodata in cod si niciodata pe GitHub.
const crypto = require('crypto');
const config = require('../config');

// Comparam amprentele SHA-256 (au mereu aceeasi lungime) in timp constant:
// nu se poate ghici cheia dupa cat dureaza verificarea.
const amprenta = (text) => crypto.createHash('sha256').update(String(text)).digest();

// true daca cererea are cheia corecta
function areCheie(req) {
  const trimisa = req.get('x-api-key');
  if (!config.apiKey || !trimisa) return false;
  return crypto.timingSafeEqual(amprenta(trimisa), amprenta(config.apiKey));
}

// Middleware: lasa cererea sa treaca doar cu cheia corecta.
function cereCheie(req, res, next) {
  if (!config.apiKey) {
    return res.status(503).json({ eroare: 'Modificarea prin API nu este activată pe server (lipsește API_KEY din .env).' });
  }
  if (!areCheie(req)) {
    return res.status(401).json({ eroare: 'Cheie API lipsă sau greșită. Trimite antetul x-api-key.' });
  }
  next();
}

module.exports = { areCheie, cereCheie };