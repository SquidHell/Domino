/* Prouve que chaque défi livré se réussit vraiment.

   tools/defis.mjs a trouvé une ligne de jeu pour chaque défi et en a tiré
   l'objectif. Ce vérificateur ne la croit pas sur parole : il rejoue cette
   ligne coup par coup avec le moteur de fusion prélevé dans index.html, et
   exige que l'objectif tombe. Si un jour le moteur change — l'ordre des
   cascades, la case où se dépose une fusion — un défi peut cesser d'être
   réussissable sans que rien ne le dise. C'est ce silence-là qu'on casse ici.

   Il vérifie aussi ce qui rendrait un défi injouable ou déloyal :
   grille connexe, murs dans les clous, main de 4 à 8 dominos tous distincts,
   coups de la solution légaux, et indice égal au premier coup de la solution.

   Usage : node tools/verify-defis.mjs [fichier.json]
*/
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeEngine } from './simulate.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FICHIER = process.argv[2] || path.join(ROOT, 'tools', 'defis.json');
const ROTS = [[0,1],[1,0],[0,-1],[-1,0]];

const defis = JSON.parse(fs.readFileSync(FICHIER, 'utf8'));
const plats = defis.flat();
const soucis = [];
const dire = (d, msg) => soucis.push(`semaine ${d.semaine+1} niveau ${d.niveau+1} : ${msg}`);

function connexe(n, murs){
  const libre = [];
  for (let i = 0; i < n*n; i++) if (!murs.has(i)) libre.push(i);
  if (!libre.length) return false;
  const vus = new Set([libre[0]]), pile = [libre[0]];
  while (pile.length){
    const i = pile.pop(), r = (i / n) | 0, c = i % n;
    for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
      const rr = r+dr, cc = c+dc, j = rr*n+cc;
      if (rr < 0 || rr >= n || cc < 0 || cc >= n || murs.has(j) || vus.has(j)) continue;
      vus.add(j); pile.push(j);
    }
  }
  return vus.size === libre.length;
}

/* Rejoue la solution, exactement comme le jeu : on pose les deux moitiés, puis
   on laisse la cascade se résoudre jusqu'au bout, et on regarde après chaque
   tour si l'objectif est atteint — un défi se gagne dès que la valeur paraît,
   pas seulement à la fin. */
function rejouer(d){
  const n = d.n, murs = new Set(d.murs);
  const moteur = makeEngine(n, murs);
  const g = Array.from({length:n}, () => Array(n).fill(null));
  let uid = 1, score = 0, sommet = 0, gagne = false;
  const restants = new Set(d.main.map((_, i) => i));

  for (const [idx, r, c, rot] of d.solution){
    if (!restants.has(idx)) return { err: `domino ${idx} joué deux fois` };
    restants.delete(idx);
    const [dr,dc] = ROTS[rot];
    const r2 = r+dr, c2 = c+dc;
    for (const [rr,cc] of [[r,c],[r2,c2]]){
      if (rr < 0 || rr >= n || cc < 0 || cc >= n) return { err: `coup hors du tapis (${rr},${cc})` };
      if (murs.has(rr*n+cc)) return { err: `coup sur un mur (${rr},${cc})` };
      if (g[rr][cc]) return { err: `coup sur une case occupée (${rr},${cc})` };
    }
    const [a,b] = d.main[idx];
    g[r][c]   = { v: a, id: uid++ };
    g[r2][c2] = { v: b, id: uid++ };
    let from = null;
    for(;;){
      const best = moteur.pickMove(g, uid, from);
      if (!best) break;
      const st = moteur.applyMove(g, best.mv, uid);
      for (let i = 0; i < n; i++) g[i] = st.g[i];
      uid = st.nextId; score += st.gained;
      sommet = Math.max(sommet, st.gained);
      from = best.mv.keep;
    }
    if (d.obj.type === 't' && g.flat().some(t => t && t.v >= d.obj.valeur)) gagne = true;
    if (d.obj.type === 's' && score >= d.obj.valeur) gagne = true;
  }
  return { gagne, score, sommet };
}

for (const d of plats){
  const n = d.n, murs = new Set(d.murs);
  if (n < 4 || n > 8) dire(d, `grille de côté ${n}`);
  if (d.murs.some(i => i < 0 || i >= n*n)) dire(d, 'un mur hors de la grille');
  if (!connexe(n, murs)) dire(d, 'grille en plusieurs morceaux');
  if (d.main.length < 4 || d.main.length > 8) dire(d, `main de ${d.main.length} dominos`);
  const paires = new Set(d.main.map(([a,b]) => Math.min(a,b) + 'x' + Math.max(a,b)));
  if (paires.size !== d.main.length) dire(d, 'deux fois le même domino dans la main');
  for (const [a,b] of d.main)
    for (const v of [a,b])
      if (!Number.isInteger(v) || v < 2 || (v & (v-1))) dire(d, `valeur de domino invalide : ${v}`);
  if (!['t','s'].includes(d.obj.type)) dire(d, `objectif de type « ${d.obj.type} »`);
  if (!(d.obj.valeur > 0)) dire(d, 'objectif nul');

  const prem = d.solution[0];
  if (!prem || d.indice.i !== prem[0] || d.indice.r !== prem[1] ||
      d.indice.c !== prem[2] || d.indice.rot !== prem[3])
    dire(d, "l'indice ne montre pas le premier coup de la solution");

  const res = rejouer(d);
  if (res.err) dire(d, res.err);
  else if (!res.gagne)
    dire(d, `la solution n'atteint pas l'objectif ${d.obj.type}${d.obj.valeur} ` +
            `(sommet ${res.sommet}, score ${res.score})`);
}

console.log(`défis vérifiés : ${plats.length} (${defis.length} semaines)`);
const tailles = plats.map(d => d.main.length);
console.log(`mains de ${Math.min(...tailles)} à ${Math.max(...tailles)} dominos · ` +
            `grilles ${[...new Set(plats.map(d => d.n))].sort().join(', ')} · ` +
            `${[...new Set(plats.map(d => d.forme))].length} formes`);
const parType = plats.reduce((m,d) => (m[d.obj.type] = (m[d.obj.type]||0)+1, m), {});
console.log(`objectifs : ${parType.t||0} par valeur de tuile, ${parType.s||0} par score`);

if (soucis.length){
  console.error(`\n❌ ${soucis.length} défi(s) en défaut :`);
  for (const s of soucis.slice(0, 25)) console.error('  · ' + s);
  if (soucis.length > 25) console.error(`  … et ${soucis.length - 25} autres`);
  process.exit(1);
}
console.log('\n✅ chaque défi a une solution jouée jusqu\'à son objectif');
