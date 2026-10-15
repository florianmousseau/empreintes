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
- L'horodatage eIDAS d'une racine (`<tour>.racine.tsr`, RFC 3161, sur les octets
  de `<tour>.racine`) se relit dans `src/horodatage.mjs`, seconde ecriture sans
  dependance comme `chaine.mjs` : l'autorite est EPINGLEE par le sha256 de son
  certificat (`AUTORITES_QUALIFIEES`, lu sur la liste de confiance de son pays).
  Une autorite nouvelle chez l'entrepot s'AJOUTE a la liste, les anciens `.tsr`
  restent a verifier. `/health` passe `attention` quand le dernier horodatage a
  plus de 36 h. Les pages ne disent ni « qualifie » ni « certifie »
  (`tests/pages.test.mjs`) : « horodatage eIDAS ».
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
- L'affichage d'un permis de construire (D-166, edifiable) est un depot de type
  `affichage` (`src/affichage.mjs`) : empreinte DECLAREE seulement (la photo
  reste sur le telephone, pas d'URL), libelle = le numero du permis lu par sa
  forme (`PC 069 123 24 A0001`), `nommeUnePersonne` dessus, memes plafonds que
  tout depot ; recu version 3 (`affichage.permis`), ligne publique a quatre
  champs. Aucune table, aucune serie, aucune regle « un depot par numero et par
  jour » cote serveur : un tiers qui lit le numero sur le panneau prendrait la
  place du petitionnaire.
- Un acte n'est RATTACHE a sa collectivite (`rattachement: site-officiel`, une
  ligne dans la table D1 `acte`) que si l'adresse demandee et l'adresse lue
  sont sur un site que l'annuaire Service-Public lui donne. La table se
  construit a la publication (`scripts/annuaire.mjs`, plancher 10 000 sites,
  `dist/annuaire/<fragment>.json`) ; un export muet publie sans elle et tout
  acte reste `declaree`. Un hote partage ou une plateforme (`PLATEFORMES`,
  ecrite a la main) ne rattache que sous le chemin propre a la commune.
- Les communes (D-178) : `/collectivite` (departements), `/collectivite/departement/<code>`
  (ses communes) et `sitemap-communes.xml` se lisent dans la table `acte` ; une commune
  sans acte rattache ne figure nulle part, sa page reste `noindex`. Un acte depose sous
  un SIREN compte a la commune que l'annuaire lui donne. `lecteurDeCommunes`
  (`src/annuaire.mjs`) n'analyse chaque fragment qu'une fois par requete. Date de
  jugement de la famille dans `docs/referencement.md`.
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
  `src/textes.mjs` (une table, les deux langues cote a cote, lue par `vue`),
  adresses et formules de la documentation dans `src/documentation.mjs`,
  textes des scripts dans `public/textes.js` par `<html lang>`. Une page ou une
  adresse nouvelle se donne aux deux editions (`src/textes.mjs`, `src/hote.mjs`,
  `_routes.json` pour un fichier partage). Pas d'acte de collectivite en allemand (renvoi 301 vers le
  francais). La typographie francaise (insecable avant `:;?!`) ne vaut que pour
  les pages francaises. `de.empreintes.pages.dev` est la voie de controle avant
  le domaine, `noindex` sur tout hote pages.dev. Le francais ne change pas d'un
  octet visible, hors `hreflang`.
- Un depot SIGNE par son deposant (D-164, REQ-7.5-03) : champ `signature`, un
  JWS compact JAdES dont la charge utile est l'empreinte du document (64 hex,
  jointe ou detachee) et le certificat dans `x5c`, ou une signature CAdES
  DETACHEE en base64 (un signataire, SHA-256, `messageDigest` = l'empreinte ;
  recu `signature.cades` au lieu de `signature.jws`). `src/origine.mjs` (MIT, sans
  dependance) verifie la signature sous la cle du certificat et sa validite a
  l'instant du depot ; il ne juge PAS l'emetteur (aucune chaine vers une liste
  de confiance encore) et la page n'ecrit jamais « qualifie ». Une signature
  refusee rend 400 et libere la lecture du temoin. Recu version 4 (`signature`
  : jws, certificat, sujet, emetteur), ligne publique a quatre champs ; rien
  n'est garde en base. `/verifier` relit la signature d'un recu telecharge.
- L'autorite d'un depot signe : `src/confiance.mjs` (MIT, pur) lit la LOTL et les
  listes nationales, retient les services CA/QC `granted` et indexe leurs
  certificats par sha256 ; `scripts/confiance.mjs` l'ecrit a chaque publication
  dans `dist/confiance/autorites.json` (plancher 500, `continue-on-error` : sans
  lui, la signature se verifie sans juger l'emetteur). `autoriteDuCertificat`
  remonte `x5c`, chaque certificat verifie sous le suivant (RSA PKCS#1, ECDSA),
  jusqu'au premier inscrit ; le recu version 4 porte alors `signature.autorite`
  (pays, nom). Le deposant doit joindre la chaine jusqu'a l'autorite dans `x5c`.
- Le certificat d'une serie d'affichage (D-166) se depose sur `/verifier` : un
  JSON `type: certificat-affichage`, format en tete de `src/serie.mjs` (pur),
  ecrit par la page du certificat d'edifiable. Chaque recu se relit contre sa
  ligne publique (`/api/recus/<id>`, six lectures en vol au plus) ; la periode
  se RECALCULE depuis la pose (deux mois), un jour passe sans photo interrompt
  la serie ; le numero du permis n'est dit relu que dans un recu complet joint
  dont l'identifiant se recalcule, la ligne publique ne le portant pas.
- La glane des actes des communes (D-178) : `src/glane.mjs` (pur) trouve sur le
  site officiel la page des actes (libelle ou chemin du lien, un second saut
  depuis la page du conseil), ses PDF, et lit nature et objet dans le libelle
  puis le nom du fichier ; sans indice de nature, ou pour un arrete du prefet,
  une convocation, un bulletin, rien n'est depose. Un objet qui nommerait une
  personne devient « Sans objet ». `scripts/glaner-actes.mjs` branche la
  politesse (robots.txt, jeton `temoinpublic`, un appel par hote toutes les
  5 s, 403/418/429/503 laisse l'hote pour le passage, agent nomme) et depose
  par `POST /api/depots` sous `authorization: Bearer <JETON_FLOTTE>` (secret
  du projet Pages). La flotte ne depose que des actes, lus sur le site
  officiel (sinon 422), sous son plafond (`ACTES_DE_LA_FLOTTE_PAR_JOUR`), hors
  du bilan public des deposants (cle de compte `flotte`), et un acte deja date
  pour sa commune rend son recu (200, `deja`). Etat et releves hors du depot.
