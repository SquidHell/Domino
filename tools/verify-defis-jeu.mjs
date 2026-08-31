/* Rejoue des défis dans le VRAI jeu, à la souris, et exige qu'ils se gagnent.

   tools/verify-defis.mjs prouve la même chose sans navigateur, avec le moteur
   de fusion prélevé dans index.html. C'est déjà solide, mais ça ne dit rien de
   ce qui entoure le moteur : la table gravée dans le fichier, son décodeur, le
   râtelier, la fin de niveau, la progression. Ici on ouvre la page, on clique
   dans le râtelier, on pivote, on pose — et on regarde si le jeu déclare le
   défi réussi et débloque le suivant.

   Un échantillon suffit : c'est la chaîne complète qu'on éprouve, pas chaque
   défi, dont la solvabilité est déjà prouvée ailleurs.

   Usage : node tools/verify-defis-jeu.mjs [nombre de défis]
*/
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const defis = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'defis.json'), 'utf8'));
const COMBIEN = Number(process.argv[2] || 14);
const ARROWS = ["→","↓","←","↑"];

// un échantillon qui balaie les semaines et couvre les sept niveaux
const echantillon = [];
for (let i = 0; i < COMBIEN; i++)
  echantillon.push([Math.floor(i * defis.length / COMBIEN), i % 7]);

const chrome = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await chromium.launch({ executablePath: chrome });
const ctx = await b.newContext({ viewport: { width: 520, height: 1000 } });
const p = await ctx.newPage();
const erreurs = [];
p.on('pageerror', e => erreurs.push('erreur JS : ' + e.message));
p.on('console', m => { const t = m.text();
  if (m.type() === 'error' && !/net::ERR_|Failed to load resource/.test(t))
    erreurs.push('console : ' + t); });

await p.goto('file://' + path.join(ROOT, 'index.html') + '?lang=fr');
await p.waitForTimeout(300);
await p.locator('#playclassic').click();          // franchir le menu d'accueil
await p.waitForTimeout(150);

let passes = 0;
for (const [s, niveau] of echantillon){
  const d = defis[s][niveau];
  const ouvert = await p.evaluate(([s,l]) => window.Domino.defi(s,l), [s, niveau]);
  if (!ouvert){ erreurs.push(`semaine ${s+1} niveau ${niveau+1} : Domino.defi a refusé`); continue; }
  await p.waitForTimeout(220);

  // le tapis doit être celui du défi : bonne taille, bons murs
  const vu = await p.evaluate(() => ({
    cases: document.querySelectorAll('.board .cell').length,
    murs:  document.querySelectorAll('.board .cell.mur').length,
    mains: document.querySelectorAll('#rack button').length,
    obj:   document.getElementById('objtxt').textContent,
    barre: !document.getElementById('defibar').hidden,
    next:  document.getElementById('slotnext').hidden
  }));
  const dit = m => erreurs.push(`semaine ${s+1} niveau ${niveau+1} : ${m}`);
  if (vu.cases !== d.n * d.n) dit(`${vu.cases} cases au lieu de ${d.n*d.n}`);
  if (vu.murs !== d.murs.length) dit(`${vu.murs} murs au lieu de ${d.murs.length}`);
  if (vu.mains !== d.main.length) dit(`${vu.mains} dominos en main au lieu de ${d.main.length}`);
  if (!vu.barre) dit('la barre de défi est restée masquée');
  if (!vu.next)  dit('le créneau « suivant » est resté visible');

  // géométrie du tapis, pour viser les cases
  const box = await p.locator('#board').boundingBox();
  const g = await p.evaluate(() => {
    const b = document.getElementById('board');
    return { gap: parseFloat(getComputedStyle(b).getPropertyValue('--gap')),
             cell: parseFloat(getComputedStyle(b).getPropertyValue('--cell')) };
  });
  const point = (r,c) => ({ x: box.x + g.gap + c*(g.cell+g.gap) + g.cell/2,
                            y: box.y + g.gap + r*(g.cell+g.gap) + g.cell/2 });

  // on rejoue la solution ; le rang dans le râtelier bouge à chaque pose
  const restants = d.main.map((_, i) => i);
  let echoue = null;
  for (const [idx, r, c, rot] of d.solution){
    if (await p.evaluate(() => window.Domino.state().phase) === 'over') break;
    const rang = restants.indexOf(idx);
    if (rang < 0){ echoue = `domino ${idx} déjà joué`; break; }
    restants.splice(rang, 1);
    await p.locator('#rack button').nth(rang).click();
    await p.waitForTimeout(60);
    let tours = 0;
    while (await p.locator('#hint').textContent() !== ARROWS[rot]){
      await p.locator('#rotate').click();
      if (++tours > 4){ echoue = 'la rotation ne suit pas'; break; }
    }
    if (echoue) break;
    const q = point(r,c);
    await p.mouse.click(q.x, q.y);
    for (let i = 0; i < 50; i++){                 // laisser la cascade finir
      await p.waitForTimeout(90);
      const st = await p.evaluate(() => window.Domino.state());
      if (st.phase !== 'anim') break;
    }
  }
  if (echoue){ dit(echoue); continue; }

  const fin = await p.evaluate(() => ({
    st: window.Domino.state(),
    titre: document.getElementById('ovtitle').textContent,
    faits: window.Domino.defis().faits
  }));
  if (!fin.st.defi || !fin.st.defi.atteint)
    dit(`objectif ${d.obj.type}${d.obj.valeur} non atteint (score ${fin.st.score})`);
  else if (fin.st.phase !== 'over')
    dit('objectif atteint mais le niveau ne se termine pas');
  else if (fin.titre !== 'Défi réussi')
    dit(`écran de fin inattendu : « ${fin.titre} »`);
  else passes++;

  // la progression ne s'écrit que pour la semaine du jour ; ailleurs on ne
  // vérifie que le déblocage quand c'est bien celle-là
  const courante = await p.evaluate(() => window.Domino.defis().semaine);
  if (s === courante && fin.faits < niveau + 1)
    dit(`réussi mais la progression reste à ${fin.faits}`);
}

await b.close();
console.log(`défis rejoués dans le jeu : ${echantillon.length} · réussis : ${passes}`);
if (erreurs.length){
  console.error(`\n❌ ${erreurs.length} problème(s) :`);
  for (const e of erreurs.slice(0, 20)) console.error('  · ' + e);
  process.exit(1);
}
console.log('\n✅ la table gravée se joue et se gagne dans le vrai jeu');
