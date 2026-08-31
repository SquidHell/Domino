/* Lecture de ce que renvoie « wrangler d1 execute --json ».
   La sortie de wrangler est précédée de lignes de journal : on repart donc du
   premier crochet ouvrant, jamais du début du fichier. Trois usages :

     classement.mjs table   <fichier> <titre>   tableau lisible du classement
     classement.mjs ligne   <fichier> <id>      la ligne visée, ou échec
     classement.mjs changes <fichier> <attendu> le nombre de lignes touchées
     classement.mjs defis   <fichier> <titre>   le classement des défis
     classement.mjs sql-defis <nombre>          le SQL qui fixe un compte

   Le pseudo n'arrive jamais par la ligne de commande : il est lu dans la
   variable d'environnement PSEUDO, validé, puis échappé ici. Rien de ce que
   saisit un humain n'est recopié tel quel dans du SQL.

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

if (mode === "defis"){
  const b = blocs(fichier);
  if (!b){ console.log(`### ${arg}\n\nRéponse illisible.\n`); process.exit(0); }
  const l = lignes(b);
  console.log(`### ${arg}\n`);
  if (!l.length){ console.log("Aucun défi inscrit.\n"); process.exit(0); }
  console.log("| rang | pseudo | défis réussis | dernier |");
  console.log("|---:|---|---:|---|");
  l.forEach((x, i) => console.log(
    `| ${i + 1} | ${String(x.name).replace(/\|/g, "\\|")} | ${x.faits} | ${x.dernier} |`));
  console.log(`\n${l.length} joueur(s).\n`);
  process.exit(0);
}

/* Fixer le nombre de défis réussis d'un pseudo.

   « Fixer » et non « ajouter » : on efface ses lignes puis on en écrit
   exactement le nombre demandé, de sorte que relancer deux fois le même
   travail donne le même résultat. Les niveaux sont pris dans l'ordre — la
   semaine 1 en entier, puis la 2 — parce qu'il faut bien un choix et que
   celui-là se raconte.

   Le pseudo est validé sur une liste blanche avant d'être échappé : c'est la
   seule saisie de texte qui approche du SQL, et elle n'y arrive qu'à ces deux
   conditions. */
if (mode === "sql-defis"){
  const brut = process.env.PSEUDO || "";
  const nombre = Number(fichier);            // ici l'argument porte le nombre
  const pseudo = brut.replace(/\s+/g, " ").trim();

  if (!pseudo){ console.error("::error::pseudo vide."); process.exit(1); }
  if (pseudo.length > 16){
    console.error(`::error::« ${pseudo} » fait plus de 16 caractères.`); process.exit(1);
  }
  if (!/^[\p{L}\p{N} ._-]+$/u.test(pseudo)){
    console.error(`::error::« ${pseudo} » contient autre chose que des lettres, chiffres, espace, point, tiret ou souligné. Refusé : ce texte approche du SQL.`);
    process.exit(1);
  }
  if (!Number.isInteger(nombre) || nombre < 0 || nombre > 364){
    console.error(`::error::« ${fichier} » n'est pas un nombre de défis entre 0 et 364.`); process.exit(1);
  }

  const q = "'" + pseudo.replace(/'/g, "''") + "'";   // échappement SQLite
  const out = [`DELETE FROM defis WHERE name = ${q};`];
  for (let i = 0; i < nombre; i++)
    out.push(`INSERT INTO defis (name, semaine, niveau) VALUES (${q}, ${Math.floor(i / 7)}, ${i % 7});`);
  console.error(`pseudo « ${pseudo} » · ${nombre} défi(s) · ${out.length} instruction(s)`);
  console.log(out.join("\n"));
  process.exit(0);
}

console.error("::error::mode inconnu : " + mode);
process.exit(1);
