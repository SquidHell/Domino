-- Classement Domino 2048.
-- Aucune colonne d'adresse IP : c'est un choix explicite, pas un oubli.
--
-- Ce fichier est rejoué tel quel à chaque déploiement, sur une base qui porte
-- déjà des données : tout y est donc idempotent — CREATE ... IF NOT EXISTS et
-- rien d'autre. Pas d'ALTER TABLE, qui échouerait au second passage.
CREATE TABLE IF NOT EXISTS scores (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  score      INTEGER NOT NULL,
  moves      INTEGER NOT NULL,          -- jamais renvoyé au classement public
  flags      TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scores_rank  ON scores (score DESC, id ASC);
CREATE INDEX IF NOT EXISTS idx_scores_flags ON scores (flags) WHERE flags <> '';
-- Le classement de la semaine ne lit qu'une tranche de dates : sans cet index,
-- il balaierait toute la table pour n'en garder que quelques jours.
CREATE INDEX IF NOT EXISTS idx_scores_date  ON scores (created_at);

-- Défis réussis. Une ligne par (pseudo, semaine, niveau) : le classement des
-- défis compte des niveaux distincts, et refaire dix fois le même n'en donne
-- pas dix. C'est la contrainte d'unicité qui le garantit, pas le client.
CREATE TABLE IF NOT EXISTS defis (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  semaine    INTEGER NOT NULL,          -- rang de la semaine dans le cycle, 0 à 51
  niveau     INTEGER NOT NULL,          -- 0 à 6
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (name, semaine, niveau)
);

CREATE INDEX IF NOT EXISTS idx_defis_nom  ON defis (name);
CREATE INDEX IF NOT EXISTS idx_defis_date ON defis (created_at);
