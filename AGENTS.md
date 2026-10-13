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
- Un acte de collectivite (D-165) est un depot de type `acte` (`src/acte.mjs`) :
  temoin d'URL obligatoire, `collectivite` (INSEE ou SIREN a cle juste),
  `nature` ; le libelle passe `nommeUnePersonne` (`src/personne.mjs`, copie
  de truecopydev/corpus et de verites, a corriger des trois cotes). Sa ligne
  publique reste a QUATRE champs (l'entrepot refuse toute ligne elargie) : la
  collectivite, la nature et le rattachement vivent dans le recu, version 2.
- Un acte n'est RATTACHE a sa collectivite (`rattachement: site-officiel`, une
  ligne dans la table D1 `acte`) que si l'adresse demandee et l'adresse lue
  sont sur un site que l'annuaire Service-Public lui donne. La table se
  construit a la publication (`scripts/annuaire.mjs`, plancher 10 000 sites,
  `dist/annuaire/<fragment>.json`) ; un export muet publie sans elle et tout
  acte reste `declaree`. Un hote partage ou une plateforme (`PLATEFORMES`,
  ecrite a la main) ne rattache que sous le chemin propre a la commune.
- Un lien colle dans Dater sur le site officiel d'une commune propose d'en
  faire un acte, la commune deja reconnue : `communeDeLAdresse`
  (`src/annuaire.mjs`) lit l'index inverse `dist/annuaire/hotes/hote-<3
  premiers caracteres>.json`, ecrit par `scripts/annuaire.mjs`. Une adresse a
  deux communes n'en propose aucune. Le rattachement reste juge par le serveur.
- Le suivi des flux (D-170) : `src/flux.mjs` decide (lecture RSS 2.0 et Atom
  1.0, plan du jour), pur ; `src/suivi.mjs` branche la base et le temoin ; le
  Worker horaire `empreintes-flux` (`flux.wrangler.toml`, `workers/flux.mjs`,
  deploye par `publier.yml` apres Pages) tourne sur la MEME base D1. Une
  version est un depot ordinaire, ligne publique a quatre champs, hors du
  plafond des depots exterieurs ; adresse et recu dans `version`, jamais un
  titre. Tables nouvelles : appliquer `SCHEMA` par l'API D1 AVANT le merge.
- L'edition allemande, « Datumszeuge » sur datumszeuge.de (`src/edition.mjs`) :
  meme moteur, meme API, meme base ; l'HOTE choisit la langue
  (`functions/_middleware.js`, decision pure dans `src/hote.mjs`, `_routes.json`
  tient les fichiers partages hors de la Function). Les pages allemandes vivent
  dans `dist/de/`, jamais servies en clair ; textes des pages dans
  `src/textes/<langue>.mjs`, textes des scripts dans `public/textes.js` par
  `<html lang>`. Pas d'acte de collectivite en allemand (renvoi 301 vers le
  francais). La typographie francaise (insecable avant `:;?!`) ne vaut que pour
  les pages francaises. `de.empreintes.pages.dev` est la voie de controle avant
  le domaine, `noindex` sur tout hote pages.dev. Le francais ne change pas d'un
  octet visible, hors `hreflang`.
