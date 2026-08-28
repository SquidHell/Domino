# Domino 2048

Un petit jeu HTML (un seul fichier, sans dépendance) qui mélange les **dominos** et le **2048**.

## Jouer

Ouvre `index.html` dans un navigateur. C'est tout.

## Règles

1. À chaque tour, un domino de deux valeurs t'est proposé (ex. `4|8`). **Choisis une case**
   (clic ou tap) : il occupe cette case et sa voisine. Il se pose **partout où deux cases
   voisines sont libres**. `R`, les flèches ou le bouton **Pivoter** le font tourner —
   droite, bas, gauche, haut — ce qui échange aussi les deux moitiés.
2. Une fois posées, les deux moitiés ne sont **plus solidaires** : ce sont deux tuiles
   ordinaires sur le tapis.
3. **Fusion au contact** : seules les valeurs égales qui se touchent fusionnent, et elles
   le font aussitôt. Deux 4 collés donnent un 8, qu'ils viennent du même domino ou de deux
   dominos différents.
4. Une fusion ne réunit jamais que **deux tuiles à la fois**, donc la somme du tapis est
   toujours exacte : trois 4 côte à côte donnent un 8 et un 4 qui reste, jamais 16. Les
   fusions s'enchaînent **une par une en cascade**, et la résolution vise toujours la
   **plus haute tuile atteignable** : le jeu choisit l'ordre des fusions *et la case où
   chacune se dépose*, de sorte qu'un 2 monte en 4 puis 8 puis 16 dès que c'est possible.
   Les deux comptent : sur `4 2 2`, si le 4 issu des deux 2 se déposait à droite il
   perdrait le contact avec le 4 déjà posé — il se dépose donc à gauche et l'escalade
   continue. À hauteur égale le jeu prend le meilleur score, puis le plus grand nombre de
   fusions ; le reste ne règle que l'ordre d'affichage. L'aperçu cercle en laiton les
   tuiles qui vont fusionner avec la pose.
5. **Le talon** ne sort un numéro qu'une fois *débloqué* : la partie commence avec des 2
   seulement, le 4 devient distribuable dès qu'une fusion en a fabriqué un, puis le 8, le
   16, le 32 et enfin le **64**. Au-delà de 64, les grosses tuiles ne s'obtiennent plus
   qu'en fusionnant. Le tirage penche vers le haut — le poids d'un numéro est sa valeur —
   sans quoi la matière distribuée reste trop maigre pour bâtir un 2048.
6. Objectif : la tuile **2048**, atteignable pour qui joue bien. Le **4096** existe, mais il
   ne se voit presque jamais. La partie s'arrête quand il ne reste plus deux cases voisines
   libres sur la grille 6×6.

Le score augmente de la valeur de chaque fusion ; le record est conservé dans le
navigateur (`localStorage`). Un aperçu du domino suivant permet d'anticiper.

## Build Y8

Une build prête pour [Y8](https://www.y8.com) vit dans `y8/` : le jeu, le minimal SDK Y8 2.0
et un adaptateur publicitaire réunis en un seul `y8/index.html`, régénérable avec
`python3 tools/build-y8.py`. Elle ajoute cinq bonus débloqués par une publicité récompensée
(continuer la partie, doubler le score, annuler le coup, changer de domino, retirer une tuile)
et un interstitiel entre deux parties, plafonné.

Le jeu de ce dépôt ne contient aucun code publicitaire : il expose seulement
`window.Domino.setAdProvider()`, et sans régie branchée aucun bouton de bonus n'apparaît.
Voir `y8/README.md`.

## Mesurer l'équilibrage

`tools/simulate.mjs` rejoue le jeu sans navigateur : le moteur de fusion n'est pas
réécrit, ses fonctions sont **extraites telles quelles de `index.html`**, seule la coque
(talon, pose, boucle de tour) est rejouée. Une partie prend quelques dizaines de
millisecondes au lieu de plusieurs minutes dans le navigateur.

```sh
node tools/verify-sim.mjs 3 22    # prouve la fidélité du simulateur
node tools/stats.mjs 120          # 120 parties par profil de joueur
```

`tools/verify-sim.mjs` injecte le **même générateur pseudo-aléatoire** dans le simulateur
et dans le vrai jeu, applique la même politique de pose, et compare le tapis case par case
et le score après chaque tour : toute divergence sort en erreur. C'est ce qui rend les
statistiques opposables.

Quatre profils de joueur sont simulés, du plus négligent (`naive`) au plus fort
(`expert`, qui joue avec deux coups d'avance en exploitant l'aperçu du domino suivant).

### Réglage retenu

Grille **6×6**, talon débloqué jusqu'à **64**, tirage pondéré par la valeur. `tools/sweep.mjs`
balaie taille de grille × plafond du talon × pondération et mesure la part des parties qui
atteignent chaque palier ; ce réglage est celui qui rend le 2048 réellement atteignable tout
en gardant le 4096 exceptionnel.
