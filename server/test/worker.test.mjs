/* Tests du Worker de classement, exécutés contre du vrai SQLite.

   D1 n'est pas disponible hors de Cloudflare : on lui substitue un adaptateur
   qui expose la même surface (prepare / bind / all / first / run) au-dessus de
   node:sqlite, et qui exécute donc le SQL réel du Worker, avec le vrai schéma.

   usage : node --experimental-sqlite server/test/worker.test.mjs            */
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE   = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA = readFileSync(path.join(HERE, "..", "schema.sql"), "utf8");
const worker = (await import(path.join(HERE, "..", "src", "index.js"))).default;

/* --- adaptateur D1 → node:sqlite --- */
function makeDB(){
  const db = new DatabaseSync(":memory:");
  db.exec(SCHEMA);
  return {
    prepare(sql){
      let params = [];
      const api = {
        bind(...args){ params = args; return api; },
        all(){ return { results: db.prepare(sql).all(...params) }; },
        first(){ const r = db.prepare(sql).get(...params); return r === undefined ? null : r; },
        run(){
          const r = db.prepare(sql).run(...params);
          return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } };
        }
      };
      return api;
    },
    _raw: db
  };
}

const BASE = "https://exemple.test";
let env;
const call = (method, url, { body, token } = {}) => {
  const headers = {};
  if (body)  headers["content-type"] = "application/json";
  if (token) headers.authorization = "Bearer " + token;
  return worker.fetch(new Request(BASE + url, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  }), env);
};
const post = (body) => call("POST", "/api/scores", { body });

let pass = true, count = 0;
function T(cond, label){ count++; pass = pass && cond; console.log((cond ? "✅" : "❌"), label); }

/* ---------------------------------------------------------------- */
env = { DB: makeDB(), ADMIN_TOKEN: "jeton-de-test" };

// 1. classement vide
let r = await call("GET", "/api/scores");
let b = await r.json();
T(r.status === 200 && Array.isArray(b.scores) && b.scores.length === 0, "classement vide au départ");
T(r.headers.get("access-control-allow-origin") === "*", "en-têtes CORS présents");

// 2. dépôt d'un score
r = await post({ name: "Alice", score: 12040, moves: 96 });
b = await r.json();
T(r.status === 201 && b.ok === true && b.rank === 1, "un score déposé revient premier");
T(typeof b.id === "number" && b.id > 0, "l'identifiant de la ligne est renvoyé");

// 3. le classement public ne divulgue pas le nombre de coups
await post({ name: "Bob", score: 30000, moves: 140 });
await post({ name: "Chloé", score: 5000, moves: 40 });
r = await call("GET", "/api/scores");
b = await r.json();
T(b.scores.map(s => s.name).join(",") === "Bob,Alice,Chloé", "tri par score décroissant");
T(b.scores.map(s => s.rank).join(",") === "1,2,3", "rangs calculés");
T(b.scores.every(s => !("moves" in s) && !("flags" in s)),
  "ni coups ni marqueurs dans le classement public");

// 4. limite
r = await call("GET", "/api/scores?limit=2");
T((await r.json()).scores.length === 2, "paramètre limit respecté");
r = await call("GET", "/api/scores?limit=99999");
T((await r.json()).scores.length === 3, "limite absurde ramenée au maximum");

// 5. validation des entrées
const cases = [
  [{ name: "",       score: 10, moves: 1 }, 400, "pseudo vide refusé"],
  [{ name: "   ",    score: 10, moves: 1 }, 400, "pseudo d'espaces refusé"],
  [{ name: "X",      score: -5, moves: 1 }, 400, "score négatif refusé"],
  [{ name: "X",      score: 1.5, moves: 1 }, 400, "score non entier refusé"],
  [{ name: "X",      score: 99_999_999, moves: 1 }, 400, "score hors bornes refusé"],
  [{ name: "X",      score: 100, moves: -1 }, 400, "coups négatifs refusés"],
  [{ name: "X",      score: 1_000_000, moves: 1 }, 422, "score impossible pour un seul coup refusé"]
];
for (const [body, status, label] of cases){
  const res = await post(body);
  T(res.status === status, label + " (" + res.status + ")");
}

// 6. nettoyage du pseudo : espaces, caractères de contrôle et marques invisibles
r = await post({ name: "  Ma\u0007ll\u200bory\u202e  ", score: 400, moves: 4 });
b = await r.json();
T(b.name === "Mallory", "pseudo nettoyé : " + JSON.stringify(b.name));
r = await post({ name: "x".repeat(40), score: 400, moves: 4 });
T((await r.json()).name.length === 16, "pseudo tronqué à 16 caractères");

// 7. marqueurs de plausibilité, invisibles côté public
// 9001/3 = 3000 points par coup, soit cinq fois le maximum jamais simulé (600),
// et 9001 n'est pas multiple de 4 : la ligne doit porter les deux marqueurs
await post({ name: "Louche", score: 9001, moves: 3 });
await post({ name: "Zero",   score: 400,  moves: 0 });     // score sans aucun coup
r = await call("GET", "/api/admin/scores?flagged=1", { token: "jeton-de-test" });
b = await r.json();
const flagged = Object.fromEntries(b.scores.map(s => [s.name, s.flags]));
T(flagged.Louche && flagged.Louche.includes("score-non-multiple-4"),
  "score non multiple de 4 marqué : " + flagged.Louche);
T(flagged.Louche.includes("ratio-eleve"), "ratio points/coup élevé marqué");
T(flagged.Zero === "sans-coup", "score sans coup marqué : " + flagged.Zero);
T(!flagged.Alice && !flagged.Bob, "les parties normales ne sont pas marquées");

// 8. la route d'administration expose bien les coups
r = await call("GET", "/api/admin/scores", { token: "jeton-de-test" });
b = await r.json();
T(b.scores.every(s => "moves" in s && "flags" in s), "l'administration voit coups et marqueurs");
const bob = b.scores.find(s => s.name === "Bob");
T(bob && bob.moves === 140, "le nombre de coups est bien conservé (" + (bob && bob.moves) + ")");

// 9. protection de l'administration
T((await call("GET", "/api/admin/scores")).status === 401, "administration sans jeton : 401");
T((await call("GET", "/api/admin/scores", { token: "mauvais" })).status === 401, "jeton erroné : 401");
T((await call("DELETE", "/api/admin/scores/1")).status === 401, "suppression sans jeton : 401");

// 10. suppression manuelle
const before = (await (await call("GET", "/api/scores?limit=100")).json()).scores;
const cible = before.find(s => s.name === "Louche");
r = await call("DELETE", "/api/admin/scores/" + cible.id, { token: "jeton-de-test" });
T((await r.json()).removed === 1, "une ligne suspecte se supprime à la main");
const after = (await (await call("GET", "/api/scores?limit=100")).json()).scores;
T(after.length === before.length - 1 && !after.some(s => s.name === "Louche"),
  "et disparaît du classement");
r = await call("DELETE", "/api/admin/scores/999999", { token: "jeton-de-test" });
T((await r.json()).removed === 0, "supprimer une ligne inexistante ne casse rien");

// 11. aucune adresse IP nulle part
const cols = env.DB._raw.prepare("PRAGMA table_info(scores)").all().map(c => c.name);
T(!cols.some(c => /ip|adresse|address/i.test(c)),
  "aucune colonne d'adresse dans le schéma : " + cols.join(", "));
const src = readFileSync(path.join(HERE, "..", "src", "index.js"), "utf8");
T(!/CF-Connecting-IP|x-forwarded-for|request\.headers\.get\(["']cf-/i.test(src),
  "le code ne lit aucune en-tête d'adresse IP");

// 12. administration non configurée
env = { DB: makeDB(), ADMIN_TOKEN: "" };
T((await call("GET", "/api/admin/scores", { token: "x" })).status === 503,
  "sans ADMIN_TOKEN, l'administration répond 503 plutôt que de s'ouvrir");

// 13. divers
env = { DB: makeDB(), ADMIN_TOKEN: "t" };
T((await call("GET", "/api/health")).status === 200, "sonde de santé");
T((await call("OPTIONS", "/api/scores")).status === 204, "préflight CORS");
T((await call("GET", "/api/inconnu")).status === 404, "route inconnue : 404");
r = await worker.fetch(new Request(BASE + "/api/scores", {
  method: "POST", headers: { "content-type": "application/json" }, body: "{pas du json" }), env);
T(r.status === 400, "corps JSON invalide : 400");
// monté sur son propre sous-domaine, sans préfixe /api
T((await call("GET", "/scores")).status === 200, "fonctionne aussi sans le préfixe /api");

console.log("\n" + count + " vérifications");
console.log(pass ? "✅ Worker conforme" : "❌ à corriger");
process.exit(pass ? 0 : 1);
