// La table des sites officiels des collectivites (D-165), construite a la
// publication depuis l'annuaire Service-Public (`api-lannuaire`), le meme export
// que l'entrepot lit pour D-161, avec le meme plancher. Pur, sauf `sitesDe` qui
// lit un fragment par la fonction qu'on lui donne.
//
// Une entree est `[hote, prefixe]` (voir `surSiteOfficiel`). Un hote donne a
// plusieurs communes, ou une plateforme ou n'importe qui ouvre une page, ne
// rattache que sous le chemin propre a la commune ; un couple hote et chemin
// donne a plusieurs communes ne rattache personne. Jamais devine : une
// collectivite absente reste « declaree ».

import { estUnInsee, estUnSiren, hoteDe, surSiteOfficiel } from './acte.mjs';

/** En dessous, l'export est tronque : la table est refusee plutot que de rattacher une commune sur deux. */
export const SITES_MIN = 10000;
export const API_ANNUAIRE =
	'https://api-lannuaire.service-public.fr/api/explore/v2.1/catalog/datasets/api-lannuaire-administration/exports/json?where=pivot%20like%20%22mairie%22&select=nom,code_insee_commune,siren,site_internet,pivot';

/** Les hotes ou chaque compte ouvre ses pages : seul le chemin y designe une commune. Ecrite a la main. */
export const PLATEFORMES = new Set([
	'facebook.com', 'fr-fr.facebook.com', 'm.facebook.com', 'instagram.com', 'x.com', 'twitter.com', 'linkedin.com', 'youtube.com',
	'sites.google.com', 'google.com', 'intramuros.org', 'lapagelocale.fr', 'station.illiwap.com', 'illiwap.com', 'linktr.ee', 'calameo.com'
]);

const tableau = (v) => (typeof v === 'string' ? JSON.parse(v || '[]') : (v ?? []));

/** L'adresse d'un site declare, `http://` ajoute quand l'annuaire l'omet ; null si ce n'est pas un site web. */
export function adresseDeSite(valeur) {
	const v = String(valeur ?? '').trim();
	if (!v) return null;
	try {
		const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `http://${v}`);
		return ['http:', 'https:'].includes(u.protocol) && u.hostname.includes('.') && !u.username ? u : null;
	} catch {
		return null;
	}
}

function sansBarreFinale(chemin) {
	let c = chemin;
	while (c.endsWith('/')) c = c.slice(0, -1);
	return c;
}

/** Le code INSEE d'une fiche mairie, ou null pour toute autre fiche. */
function inseeDeLaMairie(fiche) {
	const mairie = tableau(fiche.pivot).find((p) => p.type_service_local === 'mairie');
	const insee = String(fiche.code_insee_commune ?? tableau(mairie?.code_insee_commune)[0] ?? '');
	return mairie && estUnInsee(insee) ? insee : null;
}

const sirenDe = (fiche) => (estUnSiren(String(fiche.siren ?? '')) ? String(fiche.siren) : null);

/** Les sites d'une fiche mairie : `{ insee, siren, hote, chemin }`, un par adresse. */
export function sitesDeLaFiche(fiche) {
	const insee = inseeDeLaMairie(fiche);
	if (!insee) return [];
	const siren = sirenDe(fiche);
	return tableau(fiche.site_internet)
		.map((s) => adresseDeSite(s.valeur))
		.filter(Boolean)
		.map((u) => ({ insee, siren, hote: hoteDe(u.href), chemin: sansBarreFinale(u.pathname) }));
}

function compter(sites, cle) {
	const codes = new Map();
	for (const s of sites) {
		const k = cle(s);
		if (!codes.has(k)) codes.set(k, new Set());
		codes.get(k).add(s.insee);
	}
	return (s) => codes.get(cle(s)).size;
}

/**
 * La table, code INSEE ou SIREN vers ses sites `[hote, prefixe]`. Leve sous
 * `SITES_MIN` sites lus.
 */
export function tableDesSites(fiches) {
	const sites = fiches.flatMap(sitesDeLaFiche);
	if (sites.length < SITES_MIN) throw new Error(`annuaire : ${sites.length} sites, moins que ${SITES_MIN}, export refuse`);
	const communesDeLHote = compter(sites, (s) => s.hote);
	const communesDuChemin = compter(sites, (s) => `${s.hote}${s.chemin}`);
	const table = {};
	const ajouter = (code, entree) => {
		const deja = (table[code] ??= []);
		if (!deja.some(([h, p]) => h === entree[0] && p === entree[1])) deja.push(entree);
	};
	for (const s of sites) {
		const partage = PLATEFORMES.has(s.hote) || communesDeLHote(s) > 1;
		if (partage && (!s.chemin || communesDuChemin(s) > 1)) continue;
		const entree = partage ? [s.hote, s.chemin] : [s.hote, ''];
		ajouter(s.insee, entree);
		if (s.siren) ajouter(s.siren, entree);
	}
	return table;
}

const MAIRIE = /^Mairie\s+-\s+/;
const DELEGUEE = /^Mairie\s+d\u00e9l\u00e9gu\u00e9e\s+-\s+/i;

/**
 * Le nom de chaque commune, par code INSEE et par SIREN : `[nom, insee, siren]`.
 * Le nom vient de la fiche « Mairie - <nom> » ; une mairie deleguee ne nomme que
 * son propre code INSEE. Un SIREN porte par plusieurs codes (les arrondissements
 * de Marseille) ne designe aucune page : il n'est ni une entree ni un renvoi.
 */
export function nomsDesCommunes(fiches) {
	const table = {};
	const codesDuSiren = new Map();
	for (const fiche of fiches) {
		const insee = inseeDeLaMairie(fiche);
		const nom = String(fiche.nom ?? '');
		const principale = MAIRIE.test(nom);
		if (!insee || !(principale || DELEGUEE.test(nom)) || (table[insee] && !principale)) continue;
		const siren = principale ? sirenDe(fiche) : null;
		table[insee] = [nom.replace(MAIRIE, '').replace(DELEGUEE, '').trim(), insee, siren];
		if (siren) codesDuSiren.set(siren, (codesDuSiren.get(siren) ?? new Set()).add(insee));
	}
	for (const [siren, codes] of codesDuSiren) {
		if (codes.size === 1) table[siren] = table[[...codes][0]];
		else for (const insee of codes) table[insee][2] = null;
	}
	return table;
}

/** Le fragment qui porte un code : `insee-17` pour 17133, `siren-2117` pour 211701339. */
export const fragmentDe = (code) => (code.length === 9 ? `siren-${code.slice(0, 4)}` : `insee-${code.slice(0, 2)}`);

/** La table coupee en fragments, pour qu'une lecture ne charge que le sien. */
export function fragments(table) {
	const parts = {};
	for (const code of Object.keys(table).sort((a, b) => a.localeCompare(b))) {
		const nom = fragmentDe(code);
		parts[nom] ??= {};
		parts[nom][code] = table[code];
	}
	return parts;
}

/** Les sites d'un code, lus dans son fragment par `lire(chemin)` (une reponse fetch) ; null si absent. */
export async function sitesDe(code, lire) {
	const r = await lire(`/annuaire/${fragmentDe(code)}.json`);
	if (!r.ok) throw new Error(`annuaire : ${r.status}`);
	return (await r.json())[code] ?? null;
}

/** Le nom et les codes d'une commune, lus dans `/annuaire/communes/` ; null si absente ou illisible. */
export async function communeDe(code, lire) {
	try {
		const r = await lire(`/annuaire/communes/${fragmentDe(code)}.json`);
		const entree = r.ok ? (await r.json())[code] : null;
		return entree ? { nom: entree[0], insee: entree[1], siren: entree[2] } : null;
	} catch {
		return null;
	}
}

/** La lecture de la table publiee avec le site, par la liaison `ASSETS` d'une Function. */
export const annuaireDesActifs = (env, base) => (code) => sitesDe(code, (chemin) => env.ASSETS.fetch(new URL(chemin, base)));

/**
 * Un lecteur de communes qui ne lit et n'analyse chaque fragment qu'une fois :
 * l'index des communes en interroge des milliers dans la meme requete.
 */
export function lecteurDeCommunes(lire) {
	const fragmentsLus = new Map();
	const lireUneFois = (chemin) => {
		if (!fragmentsLus.has(chemin)) fragmentsLus.set(chemin, lire(chemin).then(async (r) => (r.ok ? r.json() : {})));
		return fragmentsLus.get(chemin);
	};
	return (code) => communeDe(code, async (chemin) => ({ ok: true, json: () => lireUneFois(chemin) }));
}

/** La lecture des noms publies avec le site, par la liaison `ASSETS` d'une Function. */
export const communeDesActifs = (env, base) => lecteurDeCommunes((chemin) => env.ASSETS.fetch(new URL(chemin, base)));

/** Le fragment de l'index des hotes qui porte un hote : `hote-mai` pour mairie-x.fr. */
export const fragmentDeLHote = (hote) => `hote-${hote.slice(0, 3).replace(/[^a-z0-9-]/g, '_')}`;

/**
 * L'index inverse de la table, hote vers `[[prefixe, insee], ...]`, sur les seuls
 * codes INSEE : il sert a reconnaitre la commune d'une adresse collee.
 */
export function tableDesHotes(table) {
	const hotes = {};
	for (const [code, sites] of Object.entries(table)) {
		if (!estUnInsee(code)) continue;
		for (const [hote, prefixe] of sites) (hotes[hote] ??= []).push([prefixe, code]);
	}
	return hotes;
}

/** L'hote et ses domaines parents, du plus long au plus court : un sous-domaine reste sur le site. */
export function hotesCandidats(hote) {
	const parties = hote.split('.');
	return parties.slice(0, -1).map((_, i) => parties.slice(i).join('.'));
}

/**
 * Le code INSEE de la commune dont le site officiel porte cette adresse, ou null
 * quand aucune ou plusieurs communes y repondent. `lire(chemin)` rend une reponse fetch.
 */
export async function communeDeLAdresse(url, lire) {
	let hote;
	try {
		hote = hoteDe(url);
	} catch {
		return null;
	}
	const codes = new Set();
	for (const candidat of hotesCandidats(hote)) {
		const r = await lire(`/annuaire/hotes/${fragmentDeLHote(candidat)}.json`);
		const entrees = r.ok ? ((await r.json())[candidat] ?? []) : [];
		for (const [prefixe, code] of entrees) if (surSiteOfficiel(url, [[candidat, prefixe]])) codes.add(code);
	}
	return codes.size === 1 ? [...codes][0] : null;
}
