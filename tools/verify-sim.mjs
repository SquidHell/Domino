/* Vérifie que tools/simulate.mjs rejoue fidèlement le vrai jeu.
   Le même générateur pseudo-aléatoire est injecté dans les deux, la même
   politique de pose est appliquée, et le tapis est comparé case par case après
   chaque tour. Toute divergence entre le simulateur et index.html sort ici. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { Game, POLICIES, mulberry32, CONF } from './simulate.mjs';

const SEEDS = Number(process.argv[2] || 3);
const TURNS = Number(process.argv[3] || 22);
const N = CONF.N;          // la taille de grille est lue dans le jeu

const b = await chromium.launch();
let mismatches = [], checked = 0;

for (let seed = 1; seed <= SEEDS; seed++){
  const ctx = await b.newContext({viewport:{width:520,height:1100}});
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  // même tirage des deux côtés
  await p.addInitScript(s => {
    let a = s >>> 0;
    Math.random = function(){
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, seed);
  await p.goto('file:///home/user/Domino/index.html');
  await p.waitForTimeout(300);
  // le jeu ouvre sur son menu : sans un mode choisi, le voile prend les clics
  await p.locator('#playclassic').click();
  await p.waitForTimeout(150);

  const box = await p.locator('#board').boundingBox();
  const g = await p.evaluate(() => { const b = document.getElementById('board');
    return { gap: parseFloat(getComputedStyle(b).getPropertyValue('--gap')),
             cell: parseFloat(getComputedStyle(b).getPropertyValue('--cell')) }; });
  const pt = (r,c) => ({ x: box.x + g.gap + c*(g.cell+g.gap) + g.cell/2,
                         y: box.y + g.gap + r*(g.cell+g.gap) + g.cell/2 });
  const readBoard = () => p.evaluate(({gap,cell,n}) => {
    const G = Array.from({length:n}, () => Array(n).fill(0));
    for (const el of document.querySelectorAll('.tile:not(.dying)')){
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      const c = Math.round((m.m41-gap)/(cell+gap)), r = Math.round((m.m42-gap)/(cell+gap));
      if (r>=0&&r<n&&c>=0&&c<n) G[r][c] = +el.textContent;
    }
    return { G, score: +document.getElementById('score').textContent,
             phase: window.Domino.state().phase,
             busy: document.querySelectorAll('.tile.dying').length };
  }, {...g, n:N});
  const settle = async () => { for (let i=0;i<60;i++){ await p.waitForTimeout(120);
    const s = await readBoard(); if (!s.busy && s.phase !== 'anim') return s; } return readBoard(); };

  const sim = new Game(mulberry32(seed));
  const arrows = ["→","↓","←","↑"];

  for (let turn = 0; turn < TURNS; turn++){
    if (!sim.alive()) break;
    const mv = POLICIES.naive(sim);
    if (!mv) break;
    const [r,c,rot] = mv;
    while ((await p.evaluate(() => document.getElementById('hint').textContent)) !== arrows[rot])
      await p.locator('#rotate').click();
    const q = pt(r,c);
    await p.mouse.click(q.x, q.y);
    const live = await settle();
    sim.play(r,c,rot);

    checked++;
    const simG = sim.g.map(row => row.map(t => t ? t.v : 0));
    if (JSON.stringify(simG) !== JSON.stringify(live.G) || sim.score !== live.score){
      mismatches.push({ seed, turn, sim: simG, jeu: live.G, simScore: sim.score, jeuScore: live.score });
      break;
    }
  }
  if (errs.length) mismatches.push({ seed, erreurJS: errs });
  await ctx.close();
}
await b.close();

console.log(`tours comparés : ${checked} (sur ${SEEDS} parties)`);
if (mismatches.length){
  console.log('❌ divergence simulateur / jeu :');
  for (const m of mismatches.slice(0,2)) console.log(JSON.stringify(m, null, 1));
} else {
  console.log('✅ tapis et score identiques à chaque tour — le simulateur rejoue bien le jeu livré');
}
process.exit(mismatches.length ? 1 : 0);
