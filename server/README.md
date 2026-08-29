# Classement Domino 2048 — Cloudflare Worker + D1

Un fichier, zéro dépendance à l'exécution : `src/index.js` est déployé tel quel, sans
étape de build. La base est D1 (le SQLite managé de Cloudflare). Le déploiement part du
dépôt git : chaque push sur `main` qui touche `server/` rejoue les tests puis redéploie.

## Ce qui est conservé, et ce qui ne l'est pas

| Champ | Stocké | Renvoyé au classement public |
|---|---|---|
| pseudo | oui | oui |
| score | oui | oui |
| date | oui | oui |
| **nombre de coups** | **oui** | **non** |
| marqueurs de plausibilité | oui | non |
| **adresse IP** | **non — jamais lue** | — |

Le nombre de coups sert uniquement à repérer une partie douteuse : un score énorme en
trois coups saute aux yeux dans la vue d'administration. Il reste invisible du public
pour ne pas donner de mode d'emploi aux tricheurs.

Trois marqueurs sont posés automatiquement à l'insertion :

| Marqueur | Déclencheur | Pourquoi c'est louche |
|---|---|---|
| `score-non-multiple-4` | `score % 4 ≠ 0` | chaque fusion vaut au moins 4 et double une puissance de 2 : un total non multiple de 4 n'a pas pu sortir du jeu |
| `sans-coup` | score > 0 et 0 coup | aucun domino posé, donc aucun point possible |
| `ratio-eleve` | plus de 2 000 points par coup | le meilleur joueur simulé plafonne vers 600 |

Au-delà de 50 000 points par coup, la ligne est refusée d'emblée (422) — c'est hors
d'atteinte, bonus publicitaires compris. Le reste passe : la modération se fait à la
main, comme demandé.

## Mise en route

Une seule commande, depuis la racine du dépôt :

```sh
./server/deploy.sh
```

Elle enchaîne tout : connexion à Cloudflare, création de la base D1, écriture de
son identifiant dans `wrangler.toml`, application du schéma, tirage du jeton
d'administration, tests, déploiement — puis elle recopie l'adresse obtenue dans
`index.html` et régénère la build Y8. Il ne reste qu'à valider les fichiers
modifiés.

Le script est rejouable : relancé, il retrouve la base existante, réapplique un
schéma en `CREATE ... IF NOT EXISTS` et ne retouche pas au jeton déjà posé.
Aucune ligne du classement n'est jamais perdue.

Le jeton d'administration n'est affiché **qu'une fois**, au moment où il est
créé : c'est le seul moment pour le mettre de côté.

Si tu préfères conduire à la main :

```sh
cd server
npm install                                   # wrangler uniquement, en dev
npx wrangler login
npx wrangler d1 create domino-2048            # recopier l'identifiant dans wrangler.toml
npm run db:remote                             # applique schema.sql à la base distante
npx wrangler secret put ADMIN_TOKEN           # une longue chaîne aléatoire, gardée pour toi
npm test                                      # 38 vérifications, sans réseau
npm run deploy
```

Wrangler affiche alors l'adresse du Worker, par exemple
`https://domino-2048-leaderboard.ton-compte.workers.dev`.

### Déploiement automatique depuis git

Une fois la première mise en ligne faite (l'identifiant de la base est alors dans
`wrangler.toml`, validé dans le dépôt — ce n'est pas un secret),
`.github/workflows/deploy-leaderboard.yml` prend le relais à chaque push.
Deux secrets à poser dans **Settings → Secrets and variables → Actions** :

- `CLOUDFLARE_API_TOKEN` — gabarit « Edit Cloudflare Workers »
- `CLOUDFLARE_ACCOUNT_ID`

Les tests tournent avant le déploiement : un Worker cassé ne part pas en production.

## Brancher le jeu

Une seule ligne à renseigner en tête du script de `index.html` :

```js
const LEADERBOARD_API = "https://domino-2048-leaderboard.ton-compte.workers.dev";
```

Puis reconstruire la build Y8 (`python3 tools/build-y8.py`). On peut aussi la poser à
chaud, sans toucher au fichier : `Domino.setLeaderboard("https://…")`, ou en définissant
`window.DOMINO_API` avant le chargement du jeu.

Tant que l'adresse est vide, **aucun appel réseau n'est émis** et le panneau du
classement reste masqué : le jeu fonctionne exactement comme avant.

## Les routes

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/scores?limit=20` | classement public — rang, pseudo, score, date |
| `POST` | `/scores` | dépôt d'un score : `{ name, score, moves }` |
| `GET` | `/admin/scores?flagged=1` | tout, coups et marqueurs compris — jeton requis |
| `DELETE` | `/admin/scores/:id` | suppression manuelle — jeton requis |
| `GET` | `/health` | sonde |

Le préfixe `/api` est optionnel : le Worker répond aussi bien monté sur `/api/*` que sur
son propre sous-domaine.

Sans `ADMIN_TOKEN`, les routes d'administration répondent **503** — elles ne s'ouvrent
jamais par défaut.

### Modérer

```sh
API=https://domino-2048-leaderboard.ton-compte.workers.dev
TOKEN=…

# les lignes marquées, avec leur nombre de coups
curl -s -H "Authorization: Bearer $TOKEN" "$API/admin/scores?flagged=1" | jq

# supprimer une ligne
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "$API/admin/scores/42"
```

## Tests

```sh
npm test        # node --experimental-sqlite test/worker.test.mjs
```

D1 n'existe pas hors de Cloudflare : les tests lui substituent un adaptateur exposant la
même surface (`prepare` / `bind` / `all` / `first` / `run`) au-dessus de `node:sqlite`.
Le SQL exécuté est donc le vrai, sur le vrai schéma. Sont couverts : tri et rangs,
absence du nombre de coups dans la réponse publique, bornes et validation des entrées,
nettoyage des pseudos (espaces, caractères de contrôle, marques de direction invisibles),
les trois marqueurs, la protection par jeton, la suppression manuelle, et l'absence de
toute lecture d'adresse IP dans le code comme dans le schéma.
