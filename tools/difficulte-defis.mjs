/* Mesure la difficulté des défis livrés, et dit lesquels n'en sont pas.

   Deux joueurs médiocres rejouent chaque défi (voir tools/defi-joueurs.mjs).
   La part de leurs parties qui atteint l'objectif donne la mesure : un défi que
   le hasard réussit une fois sur deux se gagne tout seul.

   Le tableau se lit niveau par niveau, du premier au septième, et la liste qui
   suit nomme ceux qui passent au travers du plafond de leur niveau.

   Usage : node tools/difficulte-defis.mjs [fichier.json] [--essais 120]
*/
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { taux } from './defi-joueurs.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const iE = args.indexOf('--essais');
const ESSAIS = iE >= 0 ? Number(args[iE+1]) : 120;
// le chemin est le seul argument qui ne soit ni une option ni sa valeur
const FICHIER = args.find((a, i) => !a.startsWith('--') && i !== iE + 1)
             || path.join(ROOT, 'tools', 'defis.json');

/* Ce qu'un niveau a le droit de laisser passer au hasard. Le premier niveau
   d'une semaine doit rester abordable, le septième doit résister : on descend
   donc de 45 % à 3 %. Au-delà, ce n'est plus un défi, c'est une formalité. */
export const PLAFOND = [0.45, 0.32, 0.22, 0.14, 0.08, 0.04, 0.02];

const defis = JSON.parse(fs.readFileSync(FICHIER, 'utf8'));
const plats = defis.flat();
const mesures = plats.map(d => ({ d, ...taux(d, ESSAIS) }));

const pct = x => (x * 100).toFixed(0).padStart(3) + ' %';
console.log(`${plats.length} défis · ${ESSAIS} parties au hasard par défi\n`);
console.log('niveau   hasard réussit   glouton réussit   plafond   au-dessus');
console.log('──────────────────────────────────────────────────────────────');
const fautifs = [];
for (let l = 0; l < 7; l++){
  const m = mesures.filter(x => x.d.niveau === l);
  const moyH = m.reduce((a,x) => a + x.hasard, 0) / m.length;
  const moyG = m.reduce((a,x) => a + x.glouton, 0) / m.length;
  const trop = m.filter(x => x.hasard > PLAFOND[l]);
  fautifs.push(...trop);
  console.log(`   ${l+1}     ${pct(moyH)} en moyenne    ${pct(moyG)}          ${pct(PLAFOND[l])}   ${String(trop.length).padStart(3)} / ${m.length}`);
}

const troppFacile = mesures.filter(x => x.hasard >= 0.5);
console.log(`\ndéfis que le hasard gagne au moins une fois sur deux : ${troppFacile.length} / ${plats.length}`);
console.log(`défis au-dessus du plafond de leur niveau           : ${fautifs.length} / ${plats.length}`);

if (fautifs.length){
  console.log('\nles plus faciles :');
  for (const x of fautifs.sort((a,b) => b.hasard - a.hasard).slice(0, 15))
    console.log(`  semaine ${String(x.d.semaine+1).padStart(2)} niveau ${x.d.niveau+1} · ` +
                `${x.d.obj.type}${x.d.obj.valeur} sur ${x.d.n}×${x.d.n} avec ${x.d.main.length} dominos · ` +
                `hasard ${pct(x.hasard)} (plafond ${pct(PLAFOND[x.d.niveau])})`);
}
process.exit(fautifs.length ? 1 : 0);
