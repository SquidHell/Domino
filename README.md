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
5. **Le talon** ne contient que des **2, 4, 8 et 16**, et un numéro n'en sort qu'une fois
   *débloqué* : la partie commence avec des 2 seulement, le 4 devient distribuable dès
   qu'une fusion en a fabriqué un, puis le 8, puis le 16. Au-delà de 16, les grosses tuiles
   ne s'obtiennent plus qu'en fusionnant. Chaque numéro débloqué a la même chance de sortir.
6. Objectif : la tuile **2048**. La partie s'arrête quand il ne reste plus deux cases
   voisines libres sur la grille 5×5.

Le score augmente de la valeur de chaque fusion ; le record est conservé dans le
navigateur (`localStorage`). Un aperçu du domino suivant permet d'anticiper.
