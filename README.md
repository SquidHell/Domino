# Domino 2048

Un petit jeu HTML (un seul fichier, sans dépendance) qui mélange les **dominos** et le **2048**.

## Jouer

Ouvre `index.html` dans un navigateur. C'est tout.


## Règles

1. À chaque tour, un domino de deux valeurs t'est proposé (ex. `4|8`). **Choisis une case**
   (clic ou tap) : il occupe cette case et sa voisine. Il se pose **partout où deux cases
   voisines sont libres**. `R`, les flèches ou le bouton **Pivoter** le font tourner
   droite, bas, gauche, haut ce qui échange aussi les deux moitiés.
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
   perdrait le contact avec le 4 déjà posé il se dépose donc à gauche et l'escalade
   continue. À hauteur égale le jeu prend le meilleur score, puis le plus grand nombre de
   fusions ; le reste ne règle que l'ordre d'affichage. L'aperçu cerne les tuiles
   qui vont fusionner avec la pose.
5. **Le talon** ne sort un numéro qu'une fois *débloqué* : la partie commence avec des 2
   seulement, le 4 devient distribuable dès qu'une fusion en a fabriqué un, puis le 8, le
   16, le 32, le 64 et enfin le **128**. Au-delà de 128, les grosses tuiles ne s'obtiennent
   plus qu'en fusionnant. Le tirage penche vers le haut, le poids d'un numéro est la racine
   carrée de sa valeur, sans quoi la matière distribuée reste trop maigre pour bâtir un 2048.
6. Objectif : la tuile **2048**, atteignable pour qui joue bien. Le **4096** existe, mais il
   ne se voit presque jamais. La partie s'arrête quand il ne reste plus deux cases voisines
   libres sur la grille 6×6.

**Le son est synthétisé à la volée**  aucun fichier audio, donc rien à charger. La matière
vient du domino lui-même : une plaque qui claque sur le tapis, un corps boisé sous l'os. Les
fusions chantent une gamme pentatonique qui monte avec la valeur de la tuile, si bien qu'une
cascade joue un arpège sans qu'on ait rien eu à composer. Tout passe par un passe-bas, à
volume bas. Le bouton **Son** coupe l'ensemble et le réglage est mémorisé ; une publicité
fait taire le jeu le temps de sa diffusion, sans toucher à ce réglage.

Le score augmente de la valeur de chaque fusion ; le record est conservé dans le
navigateur (`localStorage`). Un aperçu du domino suivant permet d'anticiper.

**Déclarer forfait** met fin à la partie en cours et affiche l'écran de défaite ; il est
désactivé tant qu'aucun domino n'est posé, et demande confirmation quand il y a quelque
chose à perdre : un premier clic arme le bouton (« Confirmer ? »), un second exécute, et
n'importe quelle autre action — poser un domino, pivoter, cliquer ailleurs — annule, tout
comme les 5 secondes d'inactivité. Pour repartir de zéro, l'écran de fin propose de
**rejouer**.

## Le menu

Le jeu ouvre sur un **menu** qui donne le choix du mode. **Jouer classique** lance la partie
sans fin décrite plus haut — ou reprend celle qui était en cours. **Défi de la semaine** est
annoncé mais **pas encore ouvert** : son bouton reste éteint, étiqueté « bientôt », lisible
mais inerte. Le menu n'a pas de croix et ne se ferme ni au voile ni à Échap : on en sort en
choisissant un mode.

## Cadre tourné par le portail

Sur mobile, Y8 force le paysage : il donne au jeu une iframe couchée et la fait
pivoter d'un quart de tour pour remplir un téléphone tenu droit. Le jeu s'y
affichait donc parfaitement mis en page, mais lisible de travers. Ça vaut pour
tous les jeux du portail, et rien dans le formulaire de soumission ne permet de
s'en dispenser.

Le jeu le détecte et se remet droit. De l'intérieur d'une iframe, un seul indice
est fiable : le cadre devient **plus large que l'écran entier de l'appareil**, ce
qui est impossible autrement (une iframe posée normalement dans une page ne
dépasse jamais la largeur de l'écran, et un navigateur de bureau n'a pas d'écran
plus haut que large). Quand c'est le cas, `<body>` est tourné d'un quart de tour
dans l'autre sens, largeur et hauteur échangées : les deux rotations s'annulent
et le contenu retombe pile dans le même rectangle, sans bande vide.

Deux conséquences dans le code :

- l'orientation et les paliers de taille sont portés par des **classes sur
  `<html>`** (`paysage`, `portrait`, `bas480`…) posées par `mesurer()`, et non
  par des `@media` : une media query lit toujours le cadre réel, jamais le cadre
  vu par le joueur. Les cinq `vw` passent par `--vw` pour la même raison ;
- `cellFromPoint()` ramène pointeur et plateau dans le même repère avant de
  compter les cases, sans quoi le doigt viserait à 90°.

`?tourne=0` débranche la correction, `?tourne=1` la force : les deux cas se
vérifient sans dépendre du portail.

## Build Y8

Une build prête pour [Y8](https://www.y8.com) vit dans `y8/` : le jeu, le minimal SDK Y8 2.0
et un adaptateur publicitaire réunis en un seul `y8/index.html`, régénérable avec
`python3 tools/build-y8.py`. Elle ajoute cinq bonus débloqués par une publicité récompensée
(continuer la partie, annuler le coup, changer de domino, retirer une tuile, et une offre « ×2 sur
ce domino » qui surgit à deux tours tirés au hasard)
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

Grille **6×6**, talon débloqué jusqu'à **128**, tirage pondéré par la racine de la valeur. `tools/sweep.mjs`
balaie taille de grille × plafond du talon × pondération et mesure la part des parties qui
atteignent chaque palier ; ce réglage est celui qui rend le 2048 réellement atteignable tout
en gardant le 4096 exceptionnel.

## Classement en ligne

Un service de classement vit dans `server/` : un Cloudflare Worker sans dépendance et une
base D1, déployés depuis ce dépôt par `.github/workflows/deploy-leaderboard.yml`. Il reçoit
pseudo, score et nombre de coups ; **le nombre de coups n'est jamais affiché** au classement
il ne sert qu'à repérer une partie douteuse depuis la vue d'administration, avec des
marqueurs automatiques de plausibilité. **Aucune adresse IP n'est lue ni stockée**, et la
modération se fait à la main.

Le classement ne s'étale plus sous le plateau : il vit dans son **cadre**, ouvert par le
bouton **Classement** posé à gauche du bandeau d'actions, et il se relit à chaque ouverture
puisque plus rien ne le rafraîchit sous les yeux. Le tapis récupère la hauteur qui lui était
réservée.

Le jeu n'en dépend pas : tant que `LEADERBOARD_API` est vide en tête du script, aucun appel
réseau n'est émis et le bouton reste masqué — comme lorsque le service n'a jamais répondu.
Voir `server/README.md`.
