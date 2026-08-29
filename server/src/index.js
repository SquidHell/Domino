/* Classement Domino 2048 — Cloudflare Worker + D1.
   Zéro dépendance : pas d'étape de build, le fichier déployé est celui qu'on lit.

   Ce que le serveur conserve : pseudo, score, nombre de coups, date, et des
   marqueurs de plausibilité. Le nombre de coups n'est jamais renvoyé au
   classement public — il ne sert qu'à repérer une partie douteuse depuis la
   route d'administration. Aucune adresse IP n'est lue ni stockée. */

const MAX_NAME    = 16;
const MAX_SCORE   = 10_000_000;
const MAX_MOVES   = 100_000;
const DEFAULT_TOP = 20;
const MAX_TOP     = 100;

// Repères de plausibilité. Le meilleur joueur simulé tourne autour de 400 points
// par coup et culmine vers 600 ; au-delà de SOFT on marque la ligne, au-delà de
// HARD on refuse — c'est hors d'atteinte, même avec les bonus publicitaires.
const SOFT_RATIO = 2000;
const HARD_RATIO = 50_000;

const cors = () => ({
  "access-control-allow-origin": "*",          // classement public, aucun cookie
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
  "access-control-max-age": "86400"
});

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...cors() }
  });

/* Un pseudo est du texte affiché à d'autres joueurs : on retire les caractères
   de contrôle et les marques invisibles de direction, on écrase les espaces,
   on tronque. L'affichage côté client se fait en textContent, jamais en HTML. */
const INVISIBLES = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g;
function cleanName(raw){
  if (typeof raw !== "string") return "";
  return raw.replace(INVISIBLES, "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
}
const isInt = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;

/* Marqueurs laissés en base pour retrouver une partie suspecte plus tard.
   Chaque fusion vaut au moins 4 et double une puissance de 2 : un score total
   qui n'est pas multiple de 4 n'a pas pu sortir du jeu. */
function suspicionFlags(score, moves){
  const flags = [];
  if (score % 4 !== 0)                          flags.push("score-non-multiple-4");
  if (moves === 0 && score > 0)                 flags.push("sans-coup");
  if (moves > 0 && score / moves > SOFT_RATIO)  flags.push("ratio-eleve");
  return flags.join(",");
}

/* null = administration non configurée, false = jeton refusé, true = accès */
function adminOk(request, env){
  const token = env.ADMIN_TOKEN;
  if (!token) return null;
  const header = request.headers.get("authorization") || "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (given.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= given.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

export default {
  async fetch(request, env){
    const url = new URL(request.url);
    // le Worker peut être monté sur /api/* comme sur son propre sous-domaine
    const path = url.pathname.replace(/^\/api(?=\/|$)/, "") || "/";

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
    if (path === "/health") return json({ ok: true });

    try {
      if (path === "/scores" && request.method === "GET")  return await topScores(url, env);
      if (path === "/scores" && request.method === "POST") return await submit(request, env);

      if (path === "/admin/scores" && request.method === "GET")
        return await adminList(request, url, env);

      const del = path.match(/^\/admin\/scores\/(\d+)$/);
      if (del && request.method === "DELETE")
        return await adminDelete(request, Number(del[1]), env);

      return json({ error: "route inconnue" }, 404);
    } catch (e){
      return json({ error: "erreur serveur", detail: String((e && e.message) || e) }, 500);
    }
  }
};

/* --- classement public : ni coups, ni marqueurs --- */
async function topScores(url, env){
  const asked = Number(url.searchParams.get("limit"));
  const limit = Math.min(MAX_TOP, Math.max(1, Number.isFinite(asked) && asked > 0 ? Math.floor(asked) : DEFAULT_TOP));
  const { results } = await env.DB
    .prepare("SELECT id, name, score, created_at FROM scores ORDER BY score DESC, id ASC LIMIT ?")
    .bind(limit).all();
  return json({
    scores: (results || []).map((r, i) => ({
      rank: i + 1, id: r.id, name: r.name, score: r.score, at: r.created_at
    }))
  });
}

async function submit(request, env){
  let body;
  try { body = await request.json(); }
  catch { return json({ error: "corps JSON invalide" }, 400); }

  const name  = cleanName(body && body.name);
  const score = body && body.score;
  const moves = body && body.moves;

  if (!name)                    return json({ error: "pseudo requis" }, 400);
  if (!isInt(score, MAX_SCORE)) return json({ error: "score invalide" }, 400);
  if (!isInt(moves, MAX_MOVES)) return json({ error: "nombre de coups invalide" }, 400);
  if (moves > 0 && score / moves > HARD_RATIO)
    return json({ error: "score impossible pour ce nombre de coups" }, 422);

  const res = await env.DB
    .prepare("INSERT INTO scores (name, score, moves, flags) VALUES (?, ?, ?, ?)")
    .bind(name, score, moves, suspicionFlags(score, moves)).run();

  const row = await env.DB
    .prepare("SELECT COUNT(*) AS n FROM scores WHERE score > ?")
    .bind(score).first();

  return json({
    ok: true,
    id: res.meta && res.meta.last_row_id,
    name,
    rank: (row ? row.n : 0) + 1
  }, 201);
}

/* --- administration : tout, y compris coups et marqueurs --- */
async function adminList(request, url, env){
  const ok = adminOk(request, env);
  if (ok === null)  return json({ error: "administration désactivée (ADMIN_TOKEN absent)" }, 503);
  if (ok === false) return json({ error: "jeton invalide" }, 401);

  const asked = Number(url.searchParams.get("limit"));
  const limit = Math.min(500, Math.max(1, Number.isFinite(asked) && asked > 0 ? Math.floor(asked) : 100));
  const sql = url.searchParams.get("flagged") === "1"
    ? "SELECT * FROM scores WHERE flags <> '' ORDER BY score DESC, id ASC LIMIT ?"
    : "SELECT * FROM scores ORDER BY score DESC, id ASC LIMIT ?";
  const { results } = await env.DB.prepare(sql).bind(limit).all();
  return json({ scores: results || [] });
}

async function adminDelete(request, id, env){
  const ok = adminOk(request, env);
  if (ok === null)  return json({ error: "administration désactivée (ADMIN_TOKEN absent)" }, 503);
  if (ok === false) return json({ error: "jeton invalide" }, 401);

  const res = await env.DB.prepare("DELETE FROM scores WHERE id = ?").bind(id).run();
  const removed = res.meta ? res.meta.changes : 0;
  return json({ ok: removed > 0, removed });
}
