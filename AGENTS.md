# empreintes

Surface publique et miroir du journal des empreintes de l'entrepot (D-158).

- `npm run gate` avant tout commit : `node --check`, construction, tests avec
  plancher de couverture (95 %). Il ne baisse jamais.
- Deploiement : `publier.yml`, a chaque push sur `main` (Cloudflare Pages,
  projet `empreintes`). Le journal `donnees/empreintes/` est POUSSE par
  l'entrepot depuis le VPS (cle de deploiement de ce seul depot) : c'est la
  seule ecriture directe admise sur `main`. Ce depot public ne detient aucun
  identifiant de la Box, jamais. Tant que la poussee n'existe pas,
  `donnees/copie.json` dit `suspendue` et `/health` le dit en `attention`.
- Le code passe par une branche et une PR. Commits en anglais, conventional,
  auteur Florian Mousseau <florian.mousseau@gmail.com>, aucune trace d'outil.
- `src/chaine.mjs` est l'ecriture INDEPENDANTE des formules de l'entrepot
  (`src/empreintes.mjs` la-bas) : ne pas importer le code du producteur. Le
  test de conformite est le journal reel de `donnees/` : chaque racine
  recalculee egale son fichier `.racine`.
- Rien que des empreintes : `FICHIER_PUBLIE` fixe ce qui se publie de
  `donnees/empreintes/`.
- Une page affiche, elle n'explique pas ; deux-points soudes (` `),
  tenu par `tests/pages.test.mjs`.
- Sonde : `/health` (Pages Function), 200 toujours, `alerte` sur l'age du
  dernier tour (12 h, 36 h) et les preuves restees aux calendriers (48 h) ;
  copie suspendue : `attention`, un seul constat qui la nomme.
- Le depot d'une empreinte par un tiers (D-163) : le FORMAT de la ligne
  publique `/depots/<jour>.jsonl` et du recu est ecrit en tete de
  `src/depot.mjs`, et l'entrepot le relit (feuille `depots:<n>`) : il ne
  change que par une version de recu nouvelle, jamais en place. Les gardes du
  temoin d'URL sont dans `src/temoin.mjs`, pures ; la Function ne fait que les
  brancher.
- Le depot vit dans une Function (`functions/api/depots.js`, POST) et la base
  D1 `empreintes-depots` (liaison `DEPOTS`, `wrangler.toml`) ; le schema est
  `SCHEMA` dans `src/service.mjs`, rejouable, applique par l'API D1 `query`.
  `functions/depots/[fichier].js` sert `/depots/<jour>.jsonl`. L'adresse d'un
  deposant n'est jamais ecrite : son hache sale du jour, sel jete le lendemain.
  Les tests jouent le vrai SQL sur `node:sqlite` (`tests/d1.mjs`).
