/* Simulateur headless de Domino 2048.
   Le moteur de fusion n'est PAS réécrit : les fonctions sont extraites telles
   quelles de index.html, donc ce qu'on mesure est bien le jeu livré. Seule la
   coque (talon, pose, boucle de tour) est rejouée ici, sans DOM ni animation.
   Sa fidélité est vérifiée par tools/verify-sim.mjs, qui rejoue la même partie
   dans le vrai jeu avec le même tirage et compare tuile à tuile.            */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC  = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const N = 5, CAP = 16;
const inB = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
const NB   = [[-1,0],[1,0],[0,-1],[0,1]];
const ROTS = [[0,1],[1,0],[0,-1],[-1,0]];
const MAX_DEPTH = 24, MAX_NODES = 40000;

// --- moteur de fusion, prélevé mot pour mot dans le jeu ---
function grab(name){
  const i = SRC.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('fonction introuvable dans index.html : ' + name);
  let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++){
    if (SRC[k] === '{') d++;
    else if (SRC[k] === '}' && --d === 0) return SRC.slice(i, k + 1);
  }
  throw new Error('accolade non fermée : ' + name);
}
const ENGINE = ['listMoves','applyMove','chainFrom','betterOutcome','bestOutcome','better','pickMove'];
export const engine = new Function('N','inB','NB','MAX_DEPTH','MAX_NODES',
  ENGINE.map(grab).join('\n') + `\nreturn {${ENGINE.join(',')}};`)(N, inB, NB, MAX_DEPTH, MAX_NODES);
const { listMoves, applyMove, pickMove } = engine;

// --- générateur reproductible ---
export function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- coque du jeu ---
class Game {
  constructor(rand){
    this.rand = rand;
    this.g = Array.from({length:N}, () => Array(N).fill(null));
    this.uid = 1;
    this.score = 0;
    this.unlocked = 2;
    this.placed = 0;
    this.peak = 0;
    this.merges = 0;
    this.cascades = 0;
    this.piece = this.deal();
    this.next  = this.deal();
  }
  dealValue(){
    const vals = [];
    for (let v = 2; v <= this.unlocked; v *= 2) vals.push(v);
    return vals[Math.floor(this.rand() * vals.length)];
  }
  deal(){ return { a: this.dealValue(), b: this.dealValue() }; }
  unlock(v){ if (v <= CAP && v > this.unlocked) this.unlocked = v; }

  cellsFor(r, c, rot){ const [dr,dc] = ROTS[rot]; return [[r,c],[r+dr,c+dc]]; }
  canPlace(r, c, rot){
    return this.cellsFor(r,c,rot).every(([rr,cc]) => inB(rr,cc) && !this.g[rr][cc]);
  }
  placements(){
    const out = [];
    for (let rot = 0; rot < 4; rot++)
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++)
        if (this.canPlace(r,c,rot)) out.push([r,c,rot]);
    return out;
  }
  alive(){
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++){
      if (this.g[r][c]) continue;
      for (const [dr,dc] of [[0,1],[1,0]]){
        const rr = r+dr, cc = c+dc;
        if (inB(rr,cc) && !this.g[rr][cc]) return true;
      }
    }
    return false;
  }
  // pose puis résolution, exactement dans l'ordre du jeu
  play(r, c, rot){
    const [[r1,c1],[r2,c2]] = this.cellsFor(r,c,rot);
    this.g[r1][c1] = { v: this.piece.a, id: this.uid++ };
    this.g[r2][c2] = { v: this.piece.b, id: this.uid++ };
    this.placed++;
    this.piece = this.next;
    this.next  = this.deal();          // tiré AVANT la résolution, comme dans le jeu
    this.resolve();
  }
  resolve(){
    let from = null, chain = 0;
    for(;;){
      const best = pickMove(this.g, this.uid, from);
      if (!best) break;
      const st = applyMove(this.g, best.mv, this.uid);
      this.g = st.g; this.uid = st.nextId;
      this.score += st.gained;
      this.peak = Math.max(this.peak, st.gained);
      this.unlock(st.gained);
      this.merges++; chain++;
      from = best.mv.keep;
    }
    if (chain > 1) this.cascades++;
  }
  tiles(){ return this.g.flat().filter(Boolean); }
  maxTile(){ return this.tiles().reduce((m,t) => Math.max(m, t.v), 0); }
}

/* --- profils de joueur ---------------------------------------------------
   naive    : la première case libre venue — joueur qui ne regarde pas
   greedy   : la pose qui rapporte le plus tout de suite
   tactique : la même, mais qui juge aussi le tapis laissé derrière
   expert   : deux coups d'avance, en exploitant l'aperçu du domino suivant  */
function after(game, piece, r, c, rot){
  const clone = Object.create(Game.prototype);
  Object.assign(clone, game);
  clone.g = game.g.map(row => row.slice());
  clone.rand = () => 0;                      // le tirage n'influe pas sur la résolution
  const cs = clone.cellsFor(r, c, rot);
  clone.g[cs[0][0]][cs[0][1]] = { v: piece.a, id: clone.uid++ };
  clone.g[cs[1][0]][cs[1][1]] = { v: piece.b, id: clone.uid++ };
  const before = clone.score;
  clone.resolve();
  return { gain: clone.score - before, clone };
}
const L = v => Math.log2(v);
const freeCells = g => N*N - g.flat().filter(Boolean).length;
// voisins de valeurs proches : un tapis lissé reste fusionnable
function smooth(g){
  let s = 0;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++){
    const t = g[r][c]; if (!t) continue;
    for (const [dr,dc] of [[0,1],[1,0]]){
      const o = inB(r+dr,c+dc) && g[r+dr][c+dc];
      if (o) s -= Math.abs(L(t.v) - L(o.v));
    }
  }
  return s;
}
// une grosse tuile au bord encombre moins le milieu du tapis
function edgeBias(g){
  let s = 0;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++){
    const t = g[r][c]; if (!t) continue;
    s += L(t.v) * ((r === 0 || r === N-1 ? 1 : 0) + (c === 0 || c === N-1 ? 1 : 0));
  }
  return s;
}
// au-delà de 16 une tuile n'est plus distribuée : elle ne sert que si une
// voisine peut monter jusqu'à elle, sinon c'est du poids mort
function potential(g){
  let s = 0;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++){
    const t = g[r][c]; if (!t || t.v <= CAP) continue;
    let ok = false;
    for (const [dr,dc] of NB){
      const o = inB(r+dr,c+dc) && g[r+dr][c+dc];
      if (o && (o.v === t.v || o.v === t.v / 2)) ok = true;
    }
    s += ok ? L(t.v) : -L(t.v);
  }
  return s;
}
const boardValue = g => 16*freeCells(g) + 2*smooth(g) + 3*edgeBias(g) + 8*potential(g);

const POLICIES = {
  naive: game => game.placements()[0],
  greedy: (game, rand) => {
    let best = null;
    for (const [r,c,rot] of game.placements()){
      const key = after(game, game.piece, r, c, rot).gain * 100 + rand();
      if (!best || key > best.key) best = { key, move: [r,c,rot] };
    }
    return best && best.move;
  },
  tactique: (game, rand) => {
    let best = null;
    for (const [r,c,rot] of game.placements()){
      const s = after(game, game.piece, r, c, rot);
      const key = s.gain * 3 + boardValue(s.clone.g) + rand() * 0.01;
      if (!best || key > best.key) best = { key, move: [r,c,rot] };
    }
    return best && best.move;
  },
  expert: (game, rand, beam = 6) => {
    const cand = [];
    for (const [r,c,rot] of game.placements()){
      const s = after(game, game.piece, r, c, rot);
      cand.push({ move: [r,c,rot], key: s.gain * 3 + boardValue(s.clone.g) + rand() * 0.01, clone: s.clone });
    }
    if (!cand.length) return null;
    cand.sort((a,b) => b.key - a.key);
    const top = cand.slice(0, beam);
    for (const cd of top){                       // le domino suivant est affiché : on l'exploite
      let best = -Infinity;
      for (const [r,c,rot] of cd.clone.placements()){
        const s = after(cd.clone, game.next, r, c, rot);
        best = Math.max(best, s.gain * 3 + boardValue(s.clone.g));
      }
      cd.total = cd.key + (Number.isFinite(best) ? best : -500);
    }
    top.sort((a,b) => b.total - a.total);
    return top[0].move;
  }
};

export function playGame(seed, policyName){
  const rand = mulberry32(seed);
  const game = new Game(rand);
  const policy = POLICIES[policyName];
  let turns = 0;
  while (game.alive() && turns < 2000){
    const mv = policy(game, rand);
    if (!mv) break;
    game.play(mv[0], mv[1], mv[2]);
    turns++;
  }
  return {
    maxTile: game.maxTile(), peak: game.peak, score: game.score,
    turns, merges: game.merges, cascades: game.cascades,
    tilesLeft: game.tiles().length, unlocked: game.unlocked
  };
}
export { Game, POLICIES, N, CAP };

// --- exécution en ligne de commande ---
if (process.argv[1] && process.argv[1].endsWith('simulate.mjs')){
  const games   = Number(process.argv[2] || 120);
  const seed0   = Number(process.argv[4] || 1);
  const wanted  = (process.argv[3] || 'naive,greedy,smart').split(',');
  const rows = {};
  for (const pol of wanted){
    const t0 = Date.now();
    const runs = [];
    for (let i = 0; i < games; i++) runs.push(playGame(seed0 + i, pol));
    rows[pol] = { runs, ms: Date.now() - t0 };
  }
  console.log(JSON.stringify(rows));
}
