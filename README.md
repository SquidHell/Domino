# Domino 2048

Un petit jeu HTML (un seul fichier, sans dépendance) qui mélange les **dominos** et le **2048**.

## Jouer

Ouvre `index.html` dans un navigateur. C'est tout.

## Règles

1. À chaque tour, un domino de deux valeurs t'est proposé (ex. `2|4`).
2. **Pose-le** : choisis une case (clic ou tap), le domino occupe cette case et sa voisine.
   `R`, la barre d'espace ou le bouton **Pivoter** changent le sens — droite, bas, gauche, haut —
   ce qui permet aussi d'échanger les deux moitiés.
3. **Glisse le plateau** avec les flèches `↑ ↓ ← →` (ou `ZQSD` / `WASD`, ou un balayage du doigt).
   Comme au 2048, toutes les tuiles filent dans cette direction et les valeurs identiques
   fusionnent en doublant.
4. Objectif : fabriquer la tuile **2048**. La partie s'arrête quand plus aucun domino ne rentre
   sur la grille 5×5.

Le score augmente de la valeur de chaque fusion ; le record est conservé dans le navigateur
(`localStorage`). Un aperçu du domino suivant est affiché pour anticiper.
