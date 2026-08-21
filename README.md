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
   dominos différents. Chaque tuile identique de plus double encore le résultat
   (`4+4+4 = 16`, `4+4+4+4 = 32`), et une fusion qui en déclenche une autre part en
   **cascade**. L'aperçu cercle en laiton les tuiles qui vont fusionner avec la pose.
4. **Le talon** contient des numéros réellement en jeu : une moitié reprend le plus
   souvent une valeur présente sur le tapis, l'autre apporte du matériel neuf, dont la
   taille suit la progression de la partie.
5. Objectif : la tuile **2048**. La partie s'arrête quand il ne reste plus deux cases
   voisines libres sur la grille 5×5.

Le score augmente de la valeur de chaque fusion ; le record est conservé dans le
navigateur (`localStorage`). Un aperçu du domino suivant permet d'anticiper.
