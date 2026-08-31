/* Fabrique les 364 défis (52 semaines × 7 niveaux) que le jeu embarque.

   Un défi n'est pas une partie : le talon ne distribue rien, la main est
   donnée d'avance — de 4 à 8 dominos — et il faut atteindre une valeur ou un
   score avec ces dominos-là, sur une grille qui n'est pas toujours pleine.

   Deux exigences, et elles ne se négocient pas :

   1. Chaque défi doit être RÉUSSISSABLE. On ne se contente pas d'espérer : on
      cherche une ligne de jeu, et l'objectif est ce que cette ligne a
      réellement atteint. La solution existe donc par construction, et elle est
      revérifiée en fin de course par tools/verify-defis.mjs.

   2. Le moteur de fusion n'est pas réécrit. Il est prélevé mot pour mot dans
      index.html par simulate.mjs, murs compris — une case murée est une case
      hors du tapis, ce que dit inB, et tout le reste en découle.

   La recherche est un faisceau : à chaque tour on développe tous les coups
   possibles (quel domino de la main × quelle case × quelle orientation), on
   dédoublonne les tapis identiques, et on ne garde que les LARGEUR meilleurs.
   Bien plus fort qu'un joueur, ce qu'il faut pour que l'objectif ait du mordant
   sans être hors d'atteinte.

   Cinquante-deux semaines, soit 364 jours : le cycle fait une année, et la
   table repart à sa première semaine à peu près au même moment de l'année.

   Usage : node tools/defis.mjs [--semaines 52] [--largeur 30] [--sortie <fichier>]
*/
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeEngine, mulberry32 } from './simulate.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ROTS = [[0,1],[1,0],[0,-1],[-1,0]];

const arg = (nom, def) => {
  const i = process.argv.indexOf('--' + nom);
  return i > 0 && process.argv[i+1] ? process.argv[i+1] : def;
};
const SEMAINES = Number(arg('semaines', 52));
const LARGEUR  = Number(arg('largeur', 30));
const SORTIE   = arg('sortie', path.join(ROOT, 'tools', 'defis.json'));

/* ---------- les grilles ----------
   Une forme dit quelles cases sont murées. Le jeu s'y adapte tout seul : le
   plateau reste carré, les murs sont des cases qu'on ne peut ni occuper ni
   traverser. Toutes les formes sont vérifiées connexes plus bas — un tapis en
   deux morceaux séparés serait injouable pour moitié. */
const FORMES = {
  plein:    n => [],
  coins:    n => cells(n, (r,c) => (r < 1 && c < 1) || (r < 1 && c > n-2) ||
                                   (r > n-2 && c < 1) || (r > n-2 && c > n-2)),
  losange:  n => cells(n, (r,c) => Math.abs(r-(n-1)/2) + Math.abs(c-(n-1)/2) > n/2 + 0.2),
  croix:    n => cells(n, (r,c) => (r < (n-1)/2 - 0.9 || r > (n-1)/2 + 0.9) &&
                                   (c < (n-1)/2 - 0.9 || c > (n-1)/2 + 0.9)),
  anneau:   n => cells(n, (r,c) => r > 0 && r < n-1 && c > 0 && c < n-1),
  sablier:  n => cells(n, (r,c) => r === Math.floor((n-1)/2) && (c === 0 || c === n-1)),
  couloir:  n => cells(n, (r,c) => c === Math.floor(n/2) && r % 2 === 1),
  escalier: n => cells(n, (r,c) => c > r + 1 || r > c + 2),
  peigne:   n => cells(n, (r,c) => c % 2 === 1 && r < n-1 && r > 0),
  U:        n => cells(n, (r,c) => r < n-2 && c > 0 && c < n-1),
  T:        n => cells(n, (r,c) => r > 1 && (c < 1 || c > n-2)),
  encoches: n => cells(n, (r,c) => (r === 0 && c === Math.floor(n/2)) ||
                                   (r === n-1 && c === Math.floor((n-1)/2)) ||
                                   (c === 0 && r === n-2) || (c === n-1 && r === 1)),
  ilots:    n => cells(n, (r,c) => r % 2 === 1 && c % 2 === 1)
};
function cells(n, pred){
  const out = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (pred(r,c)) out.push(r*n+c);
  return out;
}
// un tapis en deux morceaux serait injouable pour moitié : on l'écarte
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

/* ---------- la coque d'un défi ----------
   Le tapis, la main, le score. Rien d'autre : pas de talon, pas de record, pas
   de sauvegarde. Un état est immuable — jouer rend un état neuf — ce qui rend
   le faisceau trivial à écrire. */
function etatNeuf(n, main){
  return { g: Array.from({length:n}, () => Array(n).fill(null)),
           reste: main.map((_, i) => i), score: 0, peak: 0, uid: 1, ligne: [] };
}
function poses(e, n, mur, dom){
  const out = [];
  const vues = new Set();
  for (let rot = 0; rot < 4; rot++){
    const [dr,dc] = ROTS[rot];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++){
      const r2 = r+dr, c2 = c+dc;
      if (r2 < 0 || r2 >= n || c2 < 0 || c2 >= n) continue;
      if (mur.has(r*n+c) || mur.has(r2*n+c2)) continue;
      if (e.g[r][c] || e.g[r2][c2]) continue;
      // a|b posé ici et b|a posé là-bas déposent les mêmes valeurs sur les
      // mêmes cases : c'est un seul coup. La signature ne regarde donc que
      // l'ensemble { case:valeur }, sans ordre — sinon un domino symétrique
      // voyait chacun de ses coups compté deux fois.
      const sig = [(r*n+c) + ':' + dom.a, (r2*n+c2) + ':' + dom.b].sort().join('>');
      if (vues.has(sig)) continue;
      vues.add(sig);
      out.push([r,c,rot]);
    }
  }
  return out;
}
// pose puis cascade, exactement dans l'ordre du jeu
function jouer(e, n, moteur, dom, r, c, rot, idx){
  const [dr,dc] = ROTS[rot];
  const g = e.g.map(row => row.slice());
  let uid = e.uid;
  g[r][c]       = { v: dom.a, id: uid++ };
  g[r+dr][c+dc] = { v: dom.b, id: uid++ };
  let score = e.score, peak = e.peak, from = null;
  for(;;){
    const best = moteur.pickMove(g, uid, from);
    if (!best) break;
    const st = moteur.applyMove(g, best.mv, uid);
    for (let i = 0; i < n; i++) g[i] = st.g[i];
    uid = st.nextId; score += st.gained; peak = Math.max(peak, st.gained);
    from = best.mv.keep;
  }
  return { g, reste: e.reste.filter(i => i !== idx), score, peak, uid,
           ligne: e.ligne.concat([[idx, r, c, rot]]) };
}
const plusHaute = g => g.flat().reduce((m,t) => t ? Math.max(m, t.v) : m, 0);
const empreinte = g => g.flat().map(t => t ? t.v : 0).join(',');

/* Ce qu'on cherche : monter le plus haut, puis marquer le plus. À égalité on
   préfère le tapis le moins encombré — il reste des dominos à poser. */
function valeur(e, n){
  const occupe = e.g.flat().filter(Boolean).length;
  return plusHaute(e.g) * 1e6 + e.score * 10 - occupe;
}
function chercher(n, murs, main, largeur){
  const moteur = makeEngine(n, murs);
  let faisceau = [etatNeuf(n, main)];
  let meilleur = faisceau[0];
  for (let tour = 0; tour < main.length; tour++){
    const enfants = [], vus = new Set();
    for (const e of faisceau){
      for (const idx of e.reste){
        const dom = main[idx];
        for (const [r,c,rot] of poses(e, n, murs, dom)){
          const ne = jouer(e, n, moteur, dom, r, c, rot, idx);
          const emp = empreinte(ne.g) + '|' + ne.reste.join(',');
          if (vus.has(emp)) continue;
          vus.add(emp);
          enfants.push(ne);
        }
      }
    }
    if (!enfants.length) break;                 // plus rien ne rentre
    enfants.sort((a,b) => valeur(b,n) - valeur(a,n));
    faisceau = enfants.slice(0, largeur);
    if (valeur(faisceau[0], n) > valeur(meilleur, n)) meilleur = faisceau[0];
  }
  return { peak: plusHaute(meilleur.g), score: meilleur.score,
           poses: meilleur.ligne.length, ligne: meilleur.ligne };
}

/* ---------- la main ----------
   Des dominos « différents » : deux fois la même paire dans une main donne un
   4 gratuit et un défi sans intérêt. Les valeurs restent basses — de 2 à 16 —
   pour que tout ce qui monte soit fusionné et non distribué. */
function tirerMain(rand, taille, plafond){
  const vals = [];
  for (let v = 2; v <= plafond; v *= 2) vals.push(v);
  const pick = () => vals[Math.floor(rand() * vals.length)];
  const main = [], vues = new Set();
  let garde = 0;
  while (main.length < taille && garde++ < 400){
    const a = pick(), b = pick();
    const sig = Math.min(a,b) + 'x' + Math.max(a,b);
    if (vues.has(sig)) continue;
    vues.add(sig);
    main.push({ a, b });
  }
  while (main.length < taille) main.push({ a: pick(), b: pick() });   // filet
  return main;
}

/* ---------- la difficulté ----------
   Sept niveaux par semaine, du plus simple au plus retors : la main grossit,
   la grille se troue, et l'objectif se rapproche de ce que la recherche a
   trouvé de mieux. Au premier niveau on demande la moitié du sommet — un
   joueur qui découvre doit passer ; au septième, tout le sommet. */
const PALIERS = [
  { taille: 4, plafond: 8,  formes: ['plein'],                          part: 0.50 },
  { taille: 4, plafond: 16, formes: ['plein','coins'],                  part: 0.60 },
  { taille: 5, plafond: 8,  formes: ['coins','encoches','sablier'],     part: 0.70 },
  { taille: 5, plafond: 16, formes: ['losange','couloir','peigne'],     part: 0.80 },
  { taille: 6, plafond: 8,  formes: ['croix','U','T'],                  part: 0.90 },
  { taille: 7, plafond: 16, formes: ['anneau','escalier','ilots'],      part: 1.00 },
  { taille: 8, plafond: 16, formes: ['losange','croix','escalier','ilots'], part: 1.00 }
];
const TAILLES = [5, 5, 5, 6, 6, 6, 6];   // côté du plateau, niveau par niveau

/* Un objectif se lit : on arrondit le score à un palier rond. Vers le BAS,
   toujours — arrondi au plus proche, un score de 456 devenait un objectif de
   500 que la solution trouvée n'atteignait pas, et le défi était impossible.
   C'est ce que tools/verify-defis.mjs a attrapé. */
const rond = s => s >= 400 ? Math.floor(s/100)*100 : s >= 100 ? Math.floor(s/50)*50 : Math.floor(s/10)*10;

function fabriquer(semaine, niveau, rand){
  const p = PALIERS[niveau];
  const n = TAILLES[niveau];
  for (let essai = 0; essai < 60; essai++){
    const nomForme = p.formes[Math.floor(rand() * p.formes.length)];
    const murs = new Set(FORMES[nomForme](n));
    if (!connexe(n, murs)) continue;
    if (n*n - murs.size < p.taille * 2 + 2) continue;      // pas la place de poser
    const main = tirerMain(rand, p.taille, p.plafond);
    const sol = chercher(n, murs, main, LARGEUR);
    if (sol.poses < p.taille) continue;                    // la main ne rentre pas
    if (sol.peak < 8) continue;                            // rien ne fusionne : sans intérêt

    // une valeur à atteindre, ou un score : une fois sur trois, un score
    const parScore = Math.floor(rand() * 3) === 0;
    let obj;
    if (parScore){
      const cible = rond(sol.score * p.part);
      if (cible < 20) continue;
      obj = { type: 's', valeur: cible };
    } else {
      let cible = sol.peak;
      while (cible > 4 && cible > sol.peak * p.part) cible /= 2;
      if (cible < 8) continue;
      obj = { type: 't', valeur: cible };
    }
    const [idx, r, c, rot] = sol.ligne[0];
    return { n, forme: nomForme, murs: [...murs].sort((a,b) => a-b),
             main: main.map(d => [d.a, d.b]), obj,
             // l'indice montré au joueur : le premier coup de la solution
             indice: { i: idx, r, c, rot },
             // la solution entière ne part pas dans le jeu — elle sert à
             // prouver, hors ligne, que le défi se réussit vraiment
             solution: sol.ligne,
             sommet: sol.peak, scoreMax: sol.score, semaine, niveau };
  }
  return null;
}

/* ---------- fabrication ---------- */
const defis = [];
let debut = Date.now();
for (let s = 0; s < SEMAINES; s++){
  const semaine = [];
  for (let l = 0; l < 7; l++){
    // graine déterminée par (semaine, niveau) : la table se refabrique à
    // l'identique, ce qui rend le fichier produit vérifiable
    let d = null;
    for (let tentative = 0; !d && tentative < 5; tentative++)
      d = fabriquer(s, l, mulberry32(0x5EED + s * 101 + l * 7919 + tentative * 13));
    if (!d) throw new Error(`semaine ${s+1}, niveau ${l+1} : aucun défi trouvé`);
    semaine.push(d);
  }
  defis.push(semaine);
  const ecoule = ((Date.now() - debut) / 1000).toFixed(0);
  process.stdout.write(`semaine ${String(s+1).padStart(2)}/${SEMAINES} — ` +
    semaine.map(d => `${d.obj.type}${d.obj.valeur}`).join(' ') + `  (${ecoule}s)\n`);
}

fs.writeFileSync(SORTIE, JSON.stringify(defis));
const total = defis.flat().length;
console.log(`\n${total} défis écrits dans ${path.relative(ROOT, SORTIE)}`);
console.log('formes employées :', [...new Set(defis.flat().map(d => d.forme))].join(', '));
console.log('mains de', Math.min(...defis.flat().map(d => d.main.length)), 'à',
            Math.max(...defis.flat().map(d => d.main.length)), 'dominos');
