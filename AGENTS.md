# empreintes

Surface publique et miroir du journal des empreintes de l'entrepot (D-158).

- `npm run gate` avant tout commit : `node --check`, construction, tests avec
  plancher de couverture (90 %). Il ne baisse jamais.
- Deploiement : `publier.yml`, a chaque push sur `main` et chaque heure
  (Cloudflare Pages, projet `empreintes`). Le meme job commite le miroir
  `donnees/` directement sur `main` : c'est la seule ecriture directe admise.
- Le code passe par une branche et une PR. Commits en anglais, conventional,
  auteur Florian Mousseau <florian.mousseau@gmail.com>, aucune trace d'outil.
- `src/chaine.mjs` est l'ecriture INDEPENDANTE des formules de l'entrepot
  (`src/empreintes.mjs` la-bas) : ne pas importer le code du producteur. Le
  test de conformite est le journal reel de `donnees/` : chaque racine
  recalculee egale son fichier `.racine`.
- Rien que des empreintes : `FICHIER_PUBLIE` fixe ce qui sort de la Box. Un
  releve deja copie qui change sur la Box arrete la copie (il ne se reecrit
  jamais).
- Une page affiche, elle n'explique pas ; deux-points soudes (` `),
  tenu par `tests/pages.test.mjs`.
- Sonde : `/health` (Pages Function), 200 toujours, `alerte` sur l'age du
  dernier tour (12 h, 36 h) et les preuves restees aux calendriers (48 h).
