-- Migrare cu date de test: roluri si primii utilizatori
INSERT INTO rol (nume, descriere) VALUES
  ('admin', 'Administreaza utilizatorii'),
  ('proprietar', 'Publica proprietati si urmareste platile'),
  ('chirias', 'Cauta oferte si plateste chiria');

INSERT INTO utilizator (rol_id, email, parola_hash, nume, prenume, telefon) VALUES
  (1, 'admin@rentify.test', 'hash_de_test_1', 'Admin', 'Rentify', '0700000001'),
  (2, 'maria.popescu@rentify.test', 'hash_de_test_2', 'Popescu', 'Maria', '0700000002');