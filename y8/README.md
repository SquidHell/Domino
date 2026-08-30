# Build Y8 — Domino 2048

`y8/index.html` est la build prête pour Y8 : le jeu, le **minimal SDK Y8 2.0** et
l'adaptateur publicitaire, en un seul fichier. C'est ce fichier (seul) qu'on zippe
pour l'upload.

## Fabriquer la build

```sh
python3 tools/build-y8.py     # index.html + y8/y8-adapter.js → y8/index.html
```

Le jeu (`index.html` à la racine) ne contient aucun code Y8 : il expose seulement un
point de branchement. La build est donc toujours régénérable à partir du jeu nu, et
le jeu reste jouable hors Y8.

## Identifiants

| Champ | Valeur |
|---|---|
| `appId` | `6a942d3c1ee8fcff5a9e962b` |
| `gameId` | `281811` |

Ils sont en tête de `y8/y8-adapter.js`.

## Le point de branchement

Le jeu publie `window.Domino` :

| Membre | Rôle |
|---|---|
| `setAdProvider(p)` | branche la régie ; c'est ce qui **fait apparaître** les boutons de bonus |
| `pause()` / `resume()` | gèle et relance les entrées du joueur, pour `beforeAd` / `afterAd` |
| `state()` | score, record, phase, dominos posés, valeur débloquée… |
| `newGame()` | relance une partie |

La régie attendue :

```js
Domino.setAdProvider({
  showRewarded(nom, { granted, skipped }) { /* granted() UNIQUEMENT si adViewed */ },
  showInterstitial(nom) { /* silencieux, rien à accorder */ }
});
```

Sans régie branchée — SDK bloqué, jeu ouvert en local, joueur hors ligne — aucun
bouton de bonus ne s'affiche et la partie se déroule normalement.

## Les récompensées

Cinq récompenses, réparties entre deux moments : pendant la partie (dépannage) et à
la fin (relance). Toutes sont **déclenchées par le joueur**, jamais imposées.

| Bonus | `name` envoyé à Y8 | Quand | Effet |
|---|---|---|---|
| Continuer la partie | `revive` | écran de fin, 2 fois max par partie | retire les plus petites tuiles jusqu'à ce qu'un domino rentre de nouveau, et rend la main sans perdre le score |
| ×2 sur ce domino | `boost` | en jeu, à deux tours tirés au hasard | double les deux moitiés du domino en main avant qu'il soit posé (`8\|16` → `16\|32`) |
| Annuler le coup | `undo` | en jeu, et aussi sur l'écran de fin | rejoue le coup précédent — permet de rattraper la pose qui a bloqué le tapis |
| Changer de domino | `swap` | en jeu | remplace le domino en main par un autre tirage |
| Retirer une tuile | `hammer` | en jeu | le joueur désigne la tuile de son choix, elle disparaît |

Choix de conception :

- **`revive` est à l'écran de fin**, le moment où le joueur a le plus à perdre : c'est
  là que la récompensée est la mieux acceptée. Elle est limitée à deux par partie pour
  que la fin de partie garde du sens, et retirée après un forfait — reprendre une manche
  qu'on vient d'abandonner n'aurait pas de sens.
- **`boost` ne s'affiche pas en permanence** : l'offre surgit d'elle-même à deux tours
  tirés au hasard (le premier entre le 3ᵉ et le 9ᵉ domino, le second 6 à 13 dominos plus
  tard), porte sur le domino que le joueur a sous les yeux, et disparaît dès qu'il le
  pose. Une offre qui passe crée une décision immédiate — c'est ce qui la fait convertir,
  et ça évite un bouton de plus toujours grisé. Le tirage de ces deux moments utilise
  `crypto.getRandomValues` et non `Math.random`, pour ne pas décaler la suite du talon
  (voir la vérification du simulateur dans le README principal).
- **`undo` reste disponible après la fin de partie** : annuler la pose fatale est
  souvent plus intéressant que « continuer », et laisse le choix au joueur.
- **`swap` répond directement à la frustration créée par le talon restreint** (2, 4,
  8, 16 débloqués progressivement) : quand le domino tiré ne sert à rien, on en
  change.
- **`hammer` est le bonus stratégique** : il débloque un tapis verrouillé par une
  grosse tuile mal placée.
- La récompense n'est accordée que sur **`adViewed`**. `adDismissed`, une erreur, un
  SDK indisponible ou un `adBreakDone` qui ne vient jamais (chien de garde de 60 s)
  passent tous par `skipped()` : le joueur est prévenu et ne reçoit rien.
- Pendant une pub, `beforeAd` appelle `Domino.pause()` et `afterAd` /
  `adBreakDone` appellent `Domino.resume()`, donc aucune pose ne peut partir sous la
  publicité.

## Les interstitiels

`type: "next"`, `name: "new-game"`, déclenchés uniquement **entre deux parties** —
jamais pendant une partie, jamais au premier lancement. Deux garde-fous cumulés :

- une partie sur deux au maximum (`EVERY_N_GAMES = 2`) ;
- jamais moins de 90 s après la publicité précédente (`MIN_GAP_MS = 90000`).

Les deux constantes sont en tête de l'adaptateur.

## Texte de soumission Y8

À recopier tel quel dans le formulaire du portail. Sans tiret cadratin, comme
demandé : Y8 rend les descriptions en texte brut et les tirets longs y passent
mal selon les polices.

### Description

Domino 2048 crosses dominoes with the sliding number puzzle. Every domino
carries two numbers. Lay it on the board, and any tiles of the same value that
end up touching merge into a single tile worth double. Merges resolve one at a
time, and the game always follows the chain that climbs the highest, so one well
placed domino can set off a long cascade. A number only starts being dealt once
you have built it yourself, so the board grows richer as you play. Reach 2048
and take the top spot on the leaderboard.

### Description courte

Place dominoes on a 6 by 6 board and let matching numbers merge into bigger
ones. Chain the merges, climb the ladder, reach 2048.

### Instructions

Tap or click a free square to lay the domino down. It takes two neighbouring
squares, so you need two free squares side by side.

Use Rotate to turn the domino a quarter turn before you place it.

Two tiles of the same value that touch merge into one worth double, and nothing
else merges: no diagonals, no different values. Every merge scores its own
value.

Merges happen one at a time, in a cascade. The game always picks the chain that
climbs the highest, so two 2s beside a 4 give you an 8 rather than two 4s.

The game opens on 2s. A number only enters the boneyard once a merge has built
it on the board: make a 4 and 4s start being dealt, then 8s, all the way up to
128. Above that, big tiles are earned by merging alone.

The game ends when no domino fits any more. Resign ends it on purpose and gives
up any second chance.

Your goal: reach 2048 and top the leaderboard.

Controls:

Mouse or touch: point at a square to preview the domino, then click or lift your
finger to place it.

Keyboard: arrow keys aim at a square, Enter places the domino, Space or R
rotates it, M turns the sound on or off, N starts a new game, L switches between
English and French, and the question mark key opens the help panel.

## Vérifications automatisées

Les tests remplacent le CDN Y8 par un faux SDK respectant les signatures
documentées, et couvrent : `init()` avec les bons identifiants, `onAuth()`,
l'apparition des boutons, la mise en pause pendant la pub, la récompense accordée
sur `adViewed`, l'absence de récompense sur `adDismissed`, les cinq effets, les deux
règles de capping des interstitiels, et la dégradation gracieuse quand le CDN est
injoignable.
