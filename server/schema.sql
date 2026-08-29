-- Classement Domino 2048.
-- Aucune colonne d'adresse IP : c'est un choix explicite, pas un oubli.
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
