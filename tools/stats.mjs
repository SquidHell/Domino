/* Statistiques sur N parties simulées, par profil de joueur.
   usage : node tools/stats.mjs [parties=120] [graine=1]                     */
import fs from 'fs';
import { playGame } from './simulate.mjs';

const GAMES = Number(process.argv[2] || 120);
const SEED0 = Number(process.argv[3] || 1);
const PROFILS = {
  naive   : "pose sans réfléchir — première case libre venue",
  greedy  : "cherche la fusion immédiate la plus grosse",
  tactique: "fusionne, mais juge aussi le tapis qu'il laisse derrière",
  expert  : "deux coups d'avance, en exploitant l'aperçu du domino suivant"
};

const mean   = a => a.reduce((x,y)=>x+y,0) / a.length;
const median = a => { const s=[...a].sort((x,y)=>x-y), h=s.length>>1;
                      return s.length%2 ? s[h] : (s[h-1]+s[h])/2; };
const sd     = a => { const m=mean(a); return Math.sqrt(mean(a.map(x=>(x-m)**2))); };
const pct    = (a,q) => { const s=[...a].sort((x,y)=>x-y);
                          return s[Math.min(s.length-1, Math.floor(q*s.length))]; };

const out = {};
for (const [pol, desc] of Object.entries(PROFILS)){
  const t0 = Date.now();
  const runs = [];
  for (let i = 0; i < GAMES; i++) runs.push(playGame(SEED0 + i, pol));
  const max = runs.map(r => r.maxTile);
  const dist = {};
  for (const v of max) dist[v] = (dist[v] || 0) + 1;

  console.log(`\n━━ ${pol} — ${desc}`);
  console.log(`   ${GAMES} parties en ${((Date.now()-t0)/1000).toFixed(1)} s`);
  console.log(`   plus grosse tuile — moyenne ${mean(max).toFixed(0)} · médiane ${median(max)} · record ${Math.max(...max)} · plancher ${Math.min(...max)}`);
  console.log(`   moyenne géométrique (la bonne moyenne pour des puissances de 2) : ${Math.round(2**mean(max.map(Math.log2)))}`);
  console.log(`   écart-type ${sd(max).toFixed(0)} · 10 % des parties ≤ ${pct(max,0.1)} · 10 % ≥ ${pct(max,0.9)}`);
  console.log(`   score   — moyenne ${mean(runs.map(r=>r.score)).toFixed(0)} · médiane ${median(runs.map(r=>r.score))} · record ${Math.max(...runs.map(r=>r.score))}`);
  console.log(`   durée   — ${mean(runs.map(r=>r.turns)).toFixed(1)} dominos posés en moyenne (max ${Math.max(...runs.map(r=>r.turns))})`);
  console.log(`   fusions — ${mean(runs.map(r=>r.merges)).toFixed(1)} par partie, dont ${mean(runs.map(r=>r.cascades)).toFixed(1)} tours en cascade`);
  const keys = Object.keys(dist).map(Number).sort((a,b)=>a-b);
  console.log('   répartition de la plus grosse tuile :');
  for (const k of keys){
    const n = dist[k], p = 100*n/GAMES;
    console.log(`     ${String(k).padStart(4)} │${'█'.repeat(Math.round(p/2)).padEnd(50)}│ ${String(n).padStart(3)} parties  ${p.toFixed(1).padStart(5)} %`);
  }
  out[pol] = { desc, runs, dist,
               moyenne: mean(max), mediane: median(max), record: Math.max(...max),
               geo: 2**mean(max.map(Math.log2)),
               score: mean(runs.map(r=>r.score)), tours: mean(runs.map(r=>r.turns)) };
}
fs.writeFileSync(new URL('../stats.json', import.meta.url), JSON.stringify(out, null, 1));
console.log('\ndonnées brutes → stats.json');
