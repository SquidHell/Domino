/* Balayage de réglages : taille de grille × plafond du talon × pondération du
   tirage. Sert à choisir un équilibrage, pas à valider le jeu livré.
   usage : node tools/sweep.mjs [parties=24] [profil=expert]                  */
import { configure, playGame } from './simulate.mjs';

const GAMES = Number(process.argv[2] || 24);
const POL   = process.argv[3] || 'expert';
const SEED0 = 900;

const CONFIGS = [];
for (const N of [5,6,7])
  for (const CAP of [16,32,64])
    for (const WEIGHT of ['uniforme','croissant'])
      CONFIGS.push({ N, CAP, WEIGHT });

const share = (a, v) => 100 * a.filter(x => x >= v).length / a.length;
const med = a => { const s=[...a].sort((x,y)=>x-y), h=s.length>>1;
                   return s.length%2 ? s[h] : (s[h-1]+s[h])/2; };

console.log(`${GAMES} parties « ${POL} » par réglage\n`);
console.log('grille  talon  tirage     | méd.  record | ≥512   ≥1024  ≥2048  ≥4096 | tours  durée');
console.log('─'.repeat(92));
const rows = [];
for (const cfg of CONFIGS){
  configure(cfg);
  const t0 = Date.now();
  const runs = [];
  for (let i = 0; i < GAMES; i++) runs.push(playGame(SEED0 + i, POL));
  const mx = runs.map(r => r.maxTile);
  const row = { ...cfg,
    med: med(mx), record: Math.max(...mx),
    p512: share(mx,512), p1024: share(mx,1024), p2048: share(mx,2048), p4096: share(mx,4096),
    tours: runs.reduce((a,r)=>a+r.turns,0)/GAMES, ms: (Date.now()-t0)/GAMES };
  rows.push(row);
  console.log(
    `${cfg.N}×${cfg.N}     ${String(cfg.CAP).padStart(2)}     ${cfg.WEIGHT.padEnd(10)} |` +
    ` ${String(row.med).padStart(4)}  ${String(row.record).padStart(5)}  |` +
    ` ${row.p512.toFixed(0).padStart(4)}%  ${row.p1024.toFixed(0).padStart(4)}%  ${row.p2048.toFixed(0).padStart(4)}%  ${row.p4096.toFixed(0).padStart(4)}% |` +
    ` ${row.tours.toFixed(0).padStart(4)}  ${(row.ms/1000).toFixed(2)}s`);
}
console.log('\nCible : 2048 atteignable (quelques dizaines de %), 4096 très rare mais non nul.');
