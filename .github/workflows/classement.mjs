/* Lecture de ce que renvoie « wrangler d1 execute --json ».
   La sortie de wrangler est précédée de lignes de journal : on repart donc du
   premier crochet ouvrant, jamais du début du fichier. Trois usages :

     classement.mjs table   <fichier> <titre>   tableau lisible du classement
     classement.mjs ligne   <fichier> <id>      la ligne visée, ou échec
     classement.mjs changes <fichier> <attendu> le nombre de lignes touchées

   Tout ce qui est écrit sur la sortie standard part à la fois dans le journal
   et dans le résumé du travail, pour se lire depuis un téléphone. */
import fs from "node:fs";

const [, , mode, fichier, arg] = process.argv;

function blocs(f){
  const brut = fs.readFileSync(f, "utf8");
  const debut = brut.indexOf("[");
  if (debut < 0) return null;
  try {
    const b = JSON.parse(brut.slice(debut));
    return Array.isArray(b) ? b : [b];
  } catch { return null; }
}
const lignes = b => b.flatMap(x => x.results || []);

if (mode === "table"){
  const b = blocs(fichier);
  if (!b){ console.log(`### ${arg}\n\nRéponse illisible.\n`); process.exit(0); }
  const l = lignes(b);
  console.log(`### ${arg}\n`);
  if (!l.length){ console.log("Le classement est vide.\n"); process.exit(0); }
  console.log("| id | rang | pseudo | score | coups | marqueurs | date |");
  console.log("|---:|---:|---|---:|---:|---|---|");
  l.forEach((x, i) => console.log(
    `| ${x.id} | ${i + 1} | ${String(x.name).replace(/\|/g, "\\|")} | ${x.score} | ${x.moves} | ${x.flags || ""} | ${x.created_at} |`));
  console.log(`\n${l.length} ligne(s). Pour en retirer une, relance ce travail en donnant son **id**.\n`);
  process.exit(0);
}

if (mode === "ligne"){
  const b = blocs(fichier);
  if (!b){ console.error("::error::Classement illisible : rien n'a été supprimé."); process.exit(1); }
  const x = lignes(b).find(r => String(r.id) === String(arg));
  if (!x){
    console.error(`::error::Aucune ligne avec l'identifiant ${arg}. Relance sans identifiant pour revoir le classement.`);
    process.exit(1);
  }
  console.log(`### Ligne supprimée\n`);
  console.log(`\`id ${x.id}\` · **${String(x.name).replace(/\|/g, "\\|")}** · ${x.score} points · ${x.moves} coups · ${x.created_at}\n`);
  process.exit(0);
}

if (mode === "changes"){
  const b = blocs(fichier);
  const n = b ? b.reduce((a, x) => a + ((x.meta && x.meta.changes) || 0), 0) : -1;
  if (n !== Number(arg)){
    console.error(`::error::${n} ligne(s) touchée(s) au lieu de ${arg}.`);
    process.exit(1);
  }
  console.log(`${n} ligne(s) supprimée(s).`);
  process.exit(0);
}

console.error("::error::mode inconnu : " + mode);
process.exit(1);
