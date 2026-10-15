// Les pages publiques des collectivites (D-165, D-178) : `/collectivite/<code>`,
// les actes d'une commune lus sur son site officiel, une page par commune a son
// code INSEE (le SIREN et l'ecriture en minuscules y renvoient) ; `/collectivite`,
// les departements ; `/collectivite/departement/<code>`, ses communes. Une
// commune sans acte date ne figure dans aucune liste.

import { estUnInsee, estUnSiren } from './acte.mjs';
import { lireAdresse, resoudre } from './adresse.mjs';
import { DEPARTEMENTS, departementDe, nomDuDepartement } from './departements.mjs';
import { pourraitNommer } from './glane.mjs';
import { nommeUnePersonne } from './personne.mjs';
import { EDITIONS } from './edition.mjs';
import { pageAdresse, pageAdresses, pageCollectivite, pageCommunes, pageDepartement, pageIntrouvable } from './pages.mjs';
import { actesAuPrefixe, actesParCollectivite, adressePublique, serieDeLaCollectivite, versionsDeLaSource } from './service.mjs';

const HTML = { 'content-type': 'text/html; charset=utf-8' };
const LISTE = { ...HTML, 'cache-control': 'public, max-age=300' };
const introuvable = () => ({ statut: 404, corps: pageIntrouvable(), entetes: { ...HTML, 'cache-control': 'public, max-age=300' } });
const renvoi = (location) => ({ statut: 301, corps: '', entetes: { location, 'cache-control': 'public, max-age=3600' } });

/**
 * La reponse a `/collectivite/<code>` : `{ statut, corps, entetes }`.
 * `commune(code)` rend `{ nom, insee, siren }` ou null.
 */
export async function reponseCollectivite({ db, code, commune }) {
	const lu = String(code ?? '').toUpperCase();
	if (!estUnInsee(lu) && !estUnSiren(lu)) return introuvable();
	const fiche = await commune(lu);
	const canonique = fiche?.insee ?? lu;
	if (canonique !== code) return renvoi(`/collectivite/${canonique}`);
	const codes = [canonique, fiche?.siren].filter(Boolean);
	const serie = await serieDeLaCollectivite({ db, codes });
	const departement = estUnInsee(canonique) ? departementDe(canonique) : null;
	return { statut: 200, corps: pageCollectivite({ code: canonique, commune: fiche, serie, departement }), entetes: { ...HTML, 'cache-control': 'public, max-age=60' } };
}

/**
 * Les communes qui ont au moins un acte date, `[{ insee, departement, actes }]`
 * par code INSEE : un acte depose sous le SIREN compte a la commune qu'il
 * designe, un SIREN qui n'en designe aucune ne compte nulle part.
 */
export async function communesAvecActes({ db, commune }) {
	const parInsee = new Map();
	for (const { code, actes } of await actesParCollectivite({ db })) {
		const insee = estUnInsee(code) ? code : (await commune(code))?.insee;
		if (insee) parInsee.set(insee, (parInsee.get(insee) ?? 0) + actes);
	}
	return [...parInsee]
		.map(([insee, actes]) => ({ insee, departement: departementDe(insee), actes }))
		.sort((a, b) => a.insee.localeCompare(b.insee));
}

/** Les departements qui portent au moins une commune, `[{ code, nom, communes, actes }]`, dans l'ordre des codes. */
export function departementsDe(communes) {
	const parCode = new Map();
	for (const c of communes) {
		const d = parCode.get(c.departement) ?? { code: c.departement, nom: nomDuDepartement(c.departement), communes: 0, actes: 0 };
		d.communes += 1;
		d.actes += c.actes;
		parCode.set(c.departement, d);
	}
	return [...parCode.values()];
}

/** Les comptes publics des communes, `{ communes, actes, departements }` : ce que mesure le critere de D-178. */
export async function bilanDesCommunes({ db, commune }) {
	const departements = departementsDe(await communesAvecActes({ db, commune }));
	return {
		communes: departements.reduce((n, d) => n + d.communes, 0),
		actes: departements.reduce((n, d) => n + d.actes, 0),
		departements
	};
}

/** La reponse a `/collectivite` : les departements, chacun avec son compte de communes et d'actes. */
export async function reponseCommunes({ db, commune }) {
	const departements = departementsDe(await communesAvecActes({ db, commune }));
	return { statut: 200, corps: pageCommunes({ departements }), entetes: LISTE };
}

/** La reponse a `/collectivite/departement/<code>` : ses communes, chacune avec son nom et son compte d'actes. */
export async function reponseDepartement({ db, code, commune }) {
	const lu = String(code ?? '').toUpperCase();
	if (!Object.hasOwn(DEPARTEMENTS, lu)) return introuvable();
	if (lu !== code) return renvoi(`/collectivite/departement/${lu}`);
	const communes = (await communesAvecActes({ db, commune })).filter((c) => c.departement === lu);
	const nommees = await Promise.all(communes.map(async (c) => ({ ...c, nom: (await commune(c.insee))?.nom ?? null })));
	return { statut: 200, corps: pageDepartement({ code: lu, nom: DEPARTEMENTS[lu], communes: nommees }), entetes: LISTE };
}

/** Le plan des pages de communes : l'index, chaque departement et chaque commune qui ont au moins un acte. */
export function planDesCommunes(communes) {
	const adresse = EDITIONS.fr.adresse;
	const chemins = ['/collectivite', ...departementsDe(communes).map((d) => `/collectivite/departement/${d.code}`), ...communes.map((c) => `/collectivite/${c.insee}`)];
	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${chemins.map((c) => `<url><loc>${adresse}${c}</loc></url>`).join('\n')}
</urlset>
`;
}

/** La reponse a `/sitemap-communes.xml`. */
export async function reponsePlanDesCommunes({ db, commune }) {
	return { statut: 200, corps: planDesCommunes(await communesAvecActes({ db, commune })), entetes: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } };
}

/** L'objet d'un acte s'il ne peut nommer personne, null sinon. */
const objetMontrable = (acte) => (acte.objet && !nommeUnePersonne(acte.objet) && !pourraitNommer(acte.objet, acte.nature) ? acte.objet : null);

/** L'adresse lue d'un acte si ni son chemin ni son nom de fichier ne peuvent nommer personne, null sinon. */
function sourceMontrable(acte) {
	const url = acte.url ? adressePublique(acte.url) : null;
	if (!url) return null;
	const fichier = decodeURIComponent(new URL(url).pathname.split('/').pop()).replace(/[-_+.]+/g, ' ');
	return pourraitNommer(fichier, acte.nature) ? null : url;
}

const garde = (acte) => ({ ...acte, objet: objetMontrable(acte), url: sourceMontrable(acte) });

/**
 * La reponse a `/actes/<code>/<jour>/<nature>-<hex>` (D-205) : la page de l'acte
 * a sa forme canonique, 301 vers elle depuis un prefixe ou une ecriture voisine,
 * la liste des adresses pour un prefixe ambigu, 404 sinon.
 */
export async function reponseAdresse({ db, segments, commune }) {
	const lu = lireAdresse(segments);
	if (!lu) return introuvable();
	const r = resoudre(`/actes/${segments.join('/')}`, await actesAuPrefixe({ db, ...lu }));
	if (r.statut === 404) return introuvable();
	if (r.statut === 301) return renvoi(r.vers);
	if (r.statut === 300) return { statut: 300, corps: pageAdresses(r.actes), entetes: { ...HTML, 'cache-control': 'public, max-age=60' } };
	const fiche = await commune(r.acte.collectivite);
	const versions = await versionsDeLaSource({ db, collectivite: r.acte.collectivite, url: r.acte.url });
	return { statut: 200, corps: pageAdresse({ acte: garde(r.acte), commune: fiche, versions }), entetes: { ...HTML, 'cache-control': 'public, max-age=300' } };
}
