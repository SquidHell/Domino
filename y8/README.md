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
| `appId` | `6a89816ae8cd06557dc124d1` |
| `gameId` | `281105` |

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
| Doubler le score | `double` | écran de fin, 1 fois par partie | double le score de la manche, record compris |
| Annuler le coup | `undo` | en jeu, et aussi sur l'écran de fin | rejoue le coup précédent — permet de rattraper la pose qui a bloqué le tapis |
| Changer de domino | `swap` | en jeu | remplace le domino en main par un autre tirage |
| Retirer une tuile | `hammer` | en jeu | le joueur désigne la tuile de son choix, elle disparaît |

Choix de conception :

- **`revive` et `double` sont à l'écran de fin**, le moment où le joueur a le plus à
  perdre : c'est là que la récompensée est la mieux acceptée. `revive` est limité à
  deux par partie pour que la fin de partie garde du sens, `double` à une seule pour
  ne pas dénaturer le record.
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

## Vérifications automatisées

Les tests remplacent le CDN Y8 par un faux SDK respectant les signatures
documentées, et couvrent : `init()` avec les bons identifiants, `onAuth()`,
l'apparition des boutons, la mise en pause pendant la pub, la récompense accordée
sur `adViewed`, l'absence de récompense sur `adDismissed`, les cinq effets, les deux
règles de capping des interstitiels, et la dégradation gracieuse quand le CDN est
injoignable.
