# Referencement de temoinpublic.fr

Un changement en vol par famille de pages ; chacun porte sa date de jugement.

| Famille | Changement | Mis en ligne | Jugement | Mesure |
| --- | --- | --- | --- | --- |
| `/collectivite/<INSEE>` (pages de communes) | D-178 : l'entrepot lit la page des actes de chaque commune de l'annuaire et remplit sa page avant qu'on le demande ; index `/collectivite` et `/collectivite/departement/<code>`, plan `sitemap-communes.xml` | 2026-10-14 | **2026-12-15** | Search Console : impressions sur au moins 1 000 pages de commune distinctes ; requetes « conseil municipal <commune> », « deliberations <commune> », « proces-verbal <commune> ». Critere D-178 : 8 000 communes avec un acte date, 100 000 actes, 3 communes deposantes hors flotte (`/api/bilan`) |


| Famille | Changement | Mis en ligne | Jugement | Mesure |
| --- | --- | --- | --- | --- |
| `/besoin/<besoin>` (D-177, chantier 5) | une page par besoin cherche, le geste sur la page : `prouver-une-page-web`, `anteriorite-d-une-creation`, `avis-ou-annonce-supprime` ; liees de l'accueil, au plan du site. Le besoin « date de publication d'un acte » est `/acte` | a la mise en ligne de la PR | **2026-11-30** | Search Console : impressions et clics des cinq pages ; requetes « prouver qu'une page web existait », « preuve d'anteriorite », « preuve avis supprime » ; depots du jour (`/api/bilan`) apres une visite de ces pages |

| Famille | Changement | Mis en ligne | Jugement | Mesure |
| --- | --- | --- | --- | --- |
| offres sans prix (`/marches-publics`, `/publicite-des-actes`, `/date-de-publication`, `/dossier-de-sinistre`, `/versions-d-un-acte` ; D-200, D-195) | famille nee le 2026-10-16 : une page par milieu, une liste d'attente commune ; liees de l'accueil (une phrase), au plan du site, et `/publicite-des-actes` depuis chaque page de commune | 2026-10-16 | **2026-12-15** | Search Console : impressions et clics des trois pages ; `/health` `attente` par offre |

## Pari 2026-10-16 - les offres sans prix

- Ce qui change : la famille nait (cinq pages au plan du site, `/dossier-de-sinistre` et `/versions-d-un-acte` ajoutees le meme soir, avant toute mesure) et se maille depuis l'accueil, par une phrase qui lie les cinq pages, et depuis chaque page de commune vers `/publicite-des-actes` (PR #76). Pas de lien en pied de page : il toucherait tout le site, et deux paris sont en vol (`/collectivite/<INSEE>` au 2026-12-15, `/besoin/<besoin>` au 2026-11-30).
- Mesure de depart : 0 impression et 0 clic sur tout le domaine (Search Console, 11 au 13/10/2026, releve du 16/10) ; `/health` `attente` a 0 pour chaque offre au 16/10.
- Critere de jugement, chiffre et date : au 2026-12-15, au moins deux des cinq pages ont des impressions dans Search Console, et au moins une adresse attend sur une liste (`/health`). Sinon : la phrase de l'accueil cede la place a un lien depuis la page du geste voisin (`/besoin/prouver-une-page-web` vers `/date-de-publication`, `/acte` vers `/publicite-des-actes`).
- Comment il se leve (le fichier) : `OFFRES_DE_L_ACCUEIL` dans `src/offre.mjs` (vide, la phrase disparait de l'accueil) ; les pages restent au plan.
