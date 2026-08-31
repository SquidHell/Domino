/* Grave la table des défis dans index.html.

   Le jeu tient en un seul fichier — c'est ce qui lui permet de tourner sans
   serveur, hors ligne, et de partir chez un portail dans une archive. Les 350
   défis ne peuvent donc pas vivre dans un JSON à côté : ils sont encodés ici,
   en une chaîne, et remplacent celle que porte déjà index.html.

   L'encodage tient en peu de place et se relit à l'œil :

     semaines séparées par « | », niveaux par « ; », champs par « , »
     champ 1  côté de la grille                              ex. 6
     champ 2  cases murées, un caractère A64 par case        ex. 059f
     champ 3  la main, deux caractères par domino,
              chacun étant log2(valeur) : 2→1, 4→2, 8→3…     ex. 11223243
     champ 4  objectif : « t » une tuile à monter,
              « s » un score à atteindre, puis la valeur     ex. t64
     champ 5  l'indice : rang du domino, ligne, colonne,
              orientation — quatre caractères A64            ex. 0231

   Le décodeur vit dans index.html, en regard de la chaîne. La solution
   complète, elle, reste dans tools/defis.json : elle sert à prouver que les
   défis se réussissent, pas à les jouer.

   Usage : node tools/embed-defis.mjs [defis.json]
*/
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC  = process.argv[2] || path.join(ROOT, 'tools', 'defis.json');
const HTML = path.join(ROOT, 'index.html');

const A64 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+-";
const c64 = i => {
  if (!Number.isInteger(i) || i < 0 || i >= 64) throw new Error('hors A64 : ' + i);
  return A64[i];
};
const log2 = v => {
  const e = Math.log2(v);
  if (!Number.isInteger(e) || e < 1 || e > 9) throw new Error('valeur de domino : ' + v);
  return String(e);
};

const defis = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const texte = defis.map(sem => sem.map(d => [
  d.n,
  d.murs.map(c64).join(''),
  d.main.map(([a,b]) => log2(a) + log2(b)).join(''),
  d.obj.type + d.obj.valeur,
  c64(d.indice.i) + c64(d.indice.r) + c64(d.indice.c) + c64(d.indice.rot)
].join(',')).join(';')).join('|');

if (/["\\]/.test(texte)) throw new Error("l'encodage ne doit contenir ni guillemet ni antislash");

let html = fs.readFileSync(HTML, 'utf8');
const re = /(const DEFIS_BRUT = ")[^"]*(";)/;
if (!re.test(html)) throw new Error('const DEFIS_BRUT introuvable dans index.html');
html = html.replace(re, (_, a, b) => a + texte + b);
fs.writeFileSync(HTML, html);

const plats = defis.flat();
console.log(`${plats.length} défis gravés dans index.html — ${(texte.length/1024).toFixed(1)} Kio`);
console.log(`${defis.length} semaines · ${(texte.length/plats.length).toFixed(0)} caractères par défi`);
