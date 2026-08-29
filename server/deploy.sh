#!/usr/bin/env bash
# Met le classement en ligne d'un bout à l'autre : base D1, schéma, jeton
# d'administration, Worker, puis l'adresse recopiée dans le jeu.
#
#   ./server/deploy.sh
#
# Le script est rejouable : relancé, il retrouve la base existante, réapplique
# un schéma idempotent et ne redemande pas le jeton déjà posé. Rien n'est
# détruit, jamais.
set -euo pipefail
cd "$(dirname "$0")"

BASE="domino-2048"
JEU="../index.html"

gras(){ printf '\n\033[1m%s\033[0m\n' "$*"; }
info(){ printf '   %s\n' "$*"; }
mort(){ printf '\n\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

command -v node >/dev/null || mort "Node est requis (https://nodejs.org)."
W="npx --yes wrangler@4"

# --- l'identifiant de la base, lu dans la liste renvoyée par Cloudflare -------
# Les valeurs passent par l'environnement plutôt que par argv : selon qu'on
# lance « node -e » ou un fichier, argv décale d'un cran.
id_base(){
  $W d1 list --json 2>/dev/null | BASE="$BASE" node -e '
    let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
      let l=[]; try { l = JSON.parse(s); } catch(e){ return; }
      const m = (Array.isArray(l)?l:[]).find(d => d.name === process.env.BASE);
      if (m) process.stdout.write(String(m.uuid || m.database_id || ""));
    });'
}

gras "1/6 · Compte Cloudflare"
if $W whoami >/dev/null 2>&1; then
  info "déjà connecté."
else
  info "une page va s'ouvrir dans le navigateur pour autoriser wrangler."
  $W login
fi

gras "2/6 · Base de données D1"
ID="$(id_base || true)"
if [ -z "$ID" ]; then
  info "création de « $BASE »…"
  $W d1 create "$BASE" >/dev/null
  ID="$(id_base || true)"
  [ -n "$ID" ] || mort "La base a été créée mais son identifiant reste introuvable.
Ouvre le tableau de bord Cloudflare, copie l'identifiant, et renseigne-le à la
main dans server/wrangler.toml (champ database_id)."
  info "créée."
else
  info "« $BASE » existe déjà, on la réutilise."
fi
info "identifiant : $ID"

# on écrit l'identifiant dans wrangler.toml, quelle que soit sa valeur actuelle
ID="$ID" node -e '
  const fs = require("fs");
  const f = "wrangler.toml";
  const t = fs.readFileSync(f, "utf8");
  const n = t.replace(/^database_id = .*$/m, `database_id = "${process.env.ID}"`);
  if (n !== t) fs.writeFileSync(f, n);
'

gras "3/6 · Schéma"
# schema.sql est en CREATE ... IF NOT EXISTS : le rejouer ne perd aucune ligne
$W d1 execute "$BASE" --remote --file=./schema.sql --yes >/dev/null
info "tables et index en place (aucune donnée touchée)."

gras "4/6 · Jeton d'administration"
if $W secret list 2>/dev/null | grep -q ADMIN_TOKEN; then
  info "ADMIN_TOKEN est déjà posé — inchangé."
else
  JETON="$(node -e 'console.log(require("crypto").randomBytes(24).toString("base64url"))')"
  printf '%s' "$JETON" | $W secret put ADMIN_TOKEN >/dev/null
  info "jeton créé. Garde-le, il ne sera plus jamais affiché :"
  printf '\n      \033[1m%s\033[0m\n\n' "$JETON"
fi

gras "5/6 · Tests puis mise en ligne"
node --experimental-sqlite test/worker.test.mjs >/dev/null || mort "Les tests du Worker échouent : rien n'a été déployé."
info "38 vérifications passées."
SORTIE="$($W deploy 2>&1)" || { printf '%s\n' "$SORTIE"; mort "Le déploiement a échoué."; }
printf '%s\n' "$SORTIE" | sed 's/^/   /'
URL="$(printf '%s' "$SORTIE" | grep -oE 'https://[a-zA-Z0-9.-]+\.workers\.dev' | head -1 || true)"
[ -n "$URL" ] || mort "Worker déployé, mais son adresse n'a pas pu être lue plus haut.
Recopie-la à la main dans index.html (const LEADERBOARD_API)."

gras "6/6 · Brancher le jeu"
JEU="$JEU" URL="$URL" node -e '
  const fs = require("fs");
  const f = process.env.JEU, url = process.env.URL;
  const t = fs.readFileSync(f, "utf8");
  const n = t.replace(/const LEADERBOARD_API = "[^"]*";/, `const LEADERBOARD_API = "${url}";`);
  if (n === t) { console.error("   ⚠ ligne LEADERBOARD_API introuvable dans " + f); process.exit(1); }
  fs.writeFileSync(f, n);
'
info "index.html pointe désormais sur $URL"
if [ -f ../tools/build-y8.py ] && command -v python3 >/dev/null; then
  (cd .. && python3 tools/build-y8.py >/dev/null) && info "build Y8 régénérée."
fi

gras "En ligne."
cat <<FIN
   Classement    : $URL/scores
   Sonde         : $URL/health
   Modération    : curl -H "Authorization: Bearer <jeton>" "$URL/admin/scores?flagged=1"

   Il reste à valider les modifications :
     git add index.html y8/index.html server/wrangler.toml
     git commit -m "Classement en ligne"
FIN
