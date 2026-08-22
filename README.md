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
   fusions s'enchaînent **une par une en cascade**, et le jeu résout la pose dans l'ordre
   qui produit le **plus grand nombre de fusions possible** — l'ordre compte, car fusionner
   une paire peut en condamner une autre. À nombre de fusions égal il prend le meilleur
   score, puis, pour la lisibilité, poursuit la cascade en cours avant d'en ouvrir une
   autre. La tuile issue d'une fusion reste sur la case la plus récemment posée. L'aperçu
   cercle en laiton les tuiles qui vont fusionner avec la pose.
5. **Le talon** contient des numéros réellement en jeu : une moitié reprend le plus
   souvent une valeur présente sur le tapis, l'autre apporte du matériel neuf, dont la
   taille suit la progression de la partie.
6. Objectif : la tuile **2048**. La partie s'arrête quand il ne reste plus deux cases
   voisines libres sur la grille 5×5.

Le score augmente de la valeur de chaque fusion ; le record est conservé dans le
navigateur (`localStorage`). Un aperçu du domino suivant permet d'anticiper.
