# Domino 2048

Un petit jeu HTML (un seul fichier, sans dépendance) qui mélange les **dominos** et le **2048**.

## Jouer

Ouvre `index.html` dans un navigateur. C'est tout.

## Règles

1. À chaque tour, un domino de deux valeurs t'est proposé (ex. `2|16`). **Choisis une case**
   (clic ou tap) : il occupe cette case et sa voisine. `R`, les flèches ou le bouton
   **Pivoter** le font tourner — droite, bas, gauche, haut — ce qui échange aussi les
   deux moitiés.
2. **Règle du domino** : au moins une de ses moitiés doit se poser *contre une tuile de
   même valeur*. Seul le premier domino de la partie se pose librement. L'aperçu montre
   en laiton la tuile sur laquelle le domino va s'accrocher.
3. **Fusion au contact** : dès que des valeurs égales se touchent, elles fusionnent
   aussitôt. Deux tuiles donnent le double (`2+2 = 4`) et chaque tuile identique de plus
   double encore le résultat (`2+2+2 = 8`, `2+2+2+2 = 16`). Une fusion qui en déclenche
   une autre part en **cascade**, et la cascade rapporte davantage.
4. **Le talon** contient des numéros réellement en jeu : une moitié reprend le plus
   souvent une valeur présente sur le tapis, l'autre apporte du matériel neuf, dont la
   taille suit la progression de la partie. Si le domino en main ne s'accroche nulle
   part, le bouton **Piocher** s'active — comme au domino, on ne pioche que lorsqu'on
   ne peut pas jouer.
5. Objectif : la tuile **2048**. La partie s'arrête quand plus aucun domino ne peut
   s'accrocher sur la grille 5×5.

Le score augmente de la valeur de chaque fusion ; le record est conservé dans le
navigateur (`localStorage`). Un aperçu du domino suivant permet d'anticiper.
