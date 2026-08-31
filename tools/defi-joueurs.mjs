/* Des joueurs artificiels, pour mesurer si un défi en est vraiment un.

   Qu'un défi ait une solution ne dit rien de sa difficulté : encore faut-il
   savoir combien il est facile de tomber dessus. Deux joueurs délibérément
   médiocres rejouent donc chaque défi, et la part de leurs parties qui atteint
   l'objectif donne la mesure.

     hasard  — prend un domino au hasard, le pose au hasard. Le joueur qui ne
               regarde rien. S'il réussit souvent, le défi se gagne tout seul.
     glouton — prend le coup qui rapporte le plus tout de suite, sans regarder
               plus loin. Le joueur qui regarde, mais ne réfléchit pas.

   Un défi honnête laisse passer le hasard rarement, et le glouton parfois.

   `echantillonHasard` sert au générateur : plutôt que de fixer un objectif au
   jugé puis d'espérer qu'il résiste, on regarde d'abord ce que le hasard
   obtient sur cette main-là, et on place la barre au-dessus.

   Le moteur de fusion vient de index.html, comme partout ailleurs.
*/
import { makeEngine } from './simulate.mjs';

const ROTS = [[0,1],[1,0],[0,-1],[-1,0]];

export function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// tous les coups légaux pour un domino donné, sans doublon
function poses(g, n, murs, dom){
  const out = [], vues = new Set();
  for (let rot = 0; rot < 4; rot++){
    const [dr,dc] = ROTS[rot];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++){
      const r2 = r+dr, c2 = c+dc;
      if (r2 < 0 || r2 >= n || c2 < 0 || c2 >= n) continue;
      if (murs.has(r*n+c) || murs.has(r2*n+c2)) continue;
      if (g[r][c] || g[r2][c2]) continue;
      const sig = [(r*n+c)+':'+dom[0], (r2*n+c2)+':'+dom[1]].sort().join('>');
      if (vues.has(sig)) continue;
      vues.add(sig);
      out.push([r,c,rot]);
    }
  }
  return out;
}

// pose puis cascade, exactement dans l'ordre du jeu
function poser(g, n, moteur, dom, r, c, rot, uid){
  const [dr,dc] = ROTS[rot];
  const ng = g.map(row => row.slice());
  ng[r][c]       = { v: dom[0], id: uid++ };
  ng[r+dr][c+dc] = { v: dom[1], id: uid++ };
  let gagne = 0, from = null;
  for(;;){
    const best = moteur.pickMove(ng, uid, from);
    if (!best) break;
    const st = moteur.applyMove(ng, best.mv, uid);
    for (let i = 0; i < n; i++) ng[i] = st.g[i];
    uid = st.nextId; gagne += st.gained;
    from = best.mv.keep;
  }
  return { g: ng, uid, gagne };
}
const plusHaute = g => g.flat().reduce((m,t) => t ? Math.max(m, t.v) : m, 0);

/* Une partie menée jusqu'au bout par le joueur demandé. On rend la plus haute
   tuile qui ait paru sur le tapis à un moment quelconque, et le score final :
   un défi se gagne dès que la valeur paraît, la garder au chaud n'est pas
   demandé. */
function partie(n, murs, main, moteur, rand, politique){
  let g = Array.from({length:n}, () => Array(n).fill(null));
  let uid = 1, score = 0, sommet = 0;
  const reste = main.map((_, i) => i);

  while (reste.length){
    const coups = [];
    for (const idx of reste)
      for (const p of poses(g, n, murs, main[idx])) coups.push([idx, ...p]);
    if (!coups.length) break;                     // le tapis est bloqué

    let choix;
    if (politique === 'hasard'){
      choix = coups[Math.floor(rand() * coups.length)];
    } else {
      // glouton : le gain immédiat le plus gros, départages au hasard
      let meilleur = -1, ex = [];
      for (const cp of coups){
        const [idx,r,c,rot] = cp;
        const st = poser(g, n, moteur, main[idx], r, c, rot, uid);
        if (st.gagne > meilleur){ meilleur = st.gagne; ex = [cp]; }
        else if (st.gagne === meilleur) ex.push(cp);
      }
      choix = ex[Math.floor(rand() * ex.length)];
    }
    const [idx,r,c,rot] = choix;
    const st = poser(g, n, moteur, main[idx], r, c, rot, uid);
    g = st.g; uid = st.uid; score += st.gagne;
    sommet = Math.max(sommet, plusHaute(g));
    reste.splice(reste.indexOf(idx), 1);
  }
  return { sommet, score };
}

/* Ce que le hasard obtient sur cette main-là : une tuile et un score par
   partie. Le générateur s'en sert pour placer la barre — c'est la mesure qui
   décide de l'objectif, et non l'inverse. */
export function echantillonHasard(n, murs, main, essais = 150, graine = 7717){
  const moteur = makeEngine(n, murs);
  const rand = mulberry32(graine);
  const sommets = [], scores = [];
  for (let i = 0; i < essais; i++){
    const r = partie(n, murs, main, moteur, rand, 'hasard');
    sommets.push(r.sommet); scores.push(r.score);
  }
  return { sommets, scores };
}

// la part des parties du hasard qui atteignent l'objectif
export function partHasard(ech, obj){
  const src = obj.type === 's' ? ech.scores : ech.sommets;
  return src.filter(v => v >= obj.valeur).length / src.length;
}

/* Le glouton coûte cher — il évalue tous les coups à chaque tour — donc on
   l'appelle avec peu d'essais. Il est de toute façon presque déterministe. */
export function partGlouton(n, murs, main, obj, essais = 12, graine = 40503){
  const moteur = makeEngine(n, murs);
  const rand = mulberry32(graine);
  let ok = 0;
  for (let i = 0; i < essais; i++){
    const r = partie(n, murs, main, moteur, rand, 'glouton');
    if (obj.type === 's' ? r.score >= obj.valeur : r.sommet >= obj.valeur) ok++;
  }
  return ok / essais;
}

/* Mesure complète d'un défi déjà fabriqué, pour le rapport de difficulté.
   Graine fixe : deux mesures du même défi donnent le même chiffre. */
export function taux(d, essais = 120, graine = 1234){
  const murs = new Set(d.murs);
  const ech = echantillonHasard(d.n, murs, d.main, essais, graine);
  return { hasard:  partHasard(ech, d.obj),
           glouton: partGlouton(d.n, murs, d.main, d.obj,
                                Math.max(8, Math.round(essais / 8)), graine ^ 0x9E37) };
}
