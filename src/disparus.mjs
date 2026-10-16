// Ce qui a disparu (D-193) : les documents des sources de l'entrepot qui ont
// repondu 404 ou 410, change d'octets sous la meme adresse, ou quitte leur
// liste. L'entrepot calcule les evenements (`deltas/<jour>.json`, prive) ; CE
// module decide ce qui s'en publie, avant que rien n'entre dans ce depot
// public : `scripts/disparus.mjs` le joue chez l'entrepot, et la construction
// le rejoue sur `donnees/disparus/`. Pur.
//
// Ce qui ne se publie jamais :
//   - une adresse qui nommerait une personne (`nommeUnePersonne`, `pourraitNommer`) ;
//   - une source dont le retrait repond a un droit par nature (sanctions publiees
//     pour une duree legale, recueils d'actes individuels) : seules les sources de
//     `SOURCES_PUBLIEES` passent, une source nouvelle de l'entrepot attend d'y etre
//     ecrite a la main ;
//   - une adresse retiree sur un droit (RGPD, retrait legal, decision de justice),
//     instruite par `docs/legal/demandes.md` du cockpit : son sha256 entre dans
//     `RETENUES`, l'adresse elle-meme n'est jamais ecrite ici ;
//   - un evenement sans empreinte d'avant : sans elle, rien ne prouve ce qui
//     existait.

import { createHash } from 'node:crypto';
import { RETENUES, adresseNommante, texteDeLAdresse } from './retenues.mjs';

export { RETENUES, adresseNommante, texteDeLAdresse };

export const CLASSES = ['disparu', 'remplace', 'retire'];

/**
 * Les sources dont une disparition se publie. Hors liste, et pourquoi :
 * `amf-sanctions-decisions`, `acpr-sanctions-decisions` (une decision publiee
 * s'anonymise ou se retire a l'echeance que fixe la loi), `dgccrf-injonctions-sanctions`
 * (publication pour la duree que la decision fixe, art. L. 522-6 du code de la
 * consommation), `raa-bouches-du-rhone` (recueils d'actes individuels nominatifs),
 * `corpus-truecopy` (corpus de travail, pas un site surveille).
 */
export const SOURCES_PUBLIEES = new Set([
	'choisir-service-public-offres',
	'ansm-ruptures-listes-annuelles',
	'scpi-sofidy',
	'scpi-paref',
	'scpi-atland-voisin',
	'scpi-sogenial',
	'scpi-epsicap',
	'scpi-consultim',
	'scpi-corum',
	'scpi-perial',
	'av-suravenir-annexes-uc',
	'av-suravenir-reglementaire',
	'av-spirica-annexes-uc',
	'av-cardif-annexes-uc'
]);

const HEX64 = /^[0-9a-f]{64}$/;
const JOUR = /^\d{4}-\d{2}-\d{2}$/;

export const empreinteDeLAdresse = (url) => createHash('sha256').update(url).digest('hex');

const adresseLisible = (url) => {
	try {
		const u = new URL(url);
		return ['http:', 'https:'].includes(u.protocol);
	} catch {
		return false;
	}
};

/** Vrai quand un evenement de l'entrepot peut paraitre sur la page. */
export function publiable(e) {
	if (!CLASSES.includes(e?.classe) || !SOURCES_PUBLIEES.has(e.source)) return false;
	if (!JOUR.test(e.date ?? '') || !HEX64.test(e.avant?.sha256 ?? '') || !adresseLisible(e.url)) return false;
	if (RETENUES.has(empreinteDeLAdresse(e.url))) return false;
	return !adresseNommante(e.url);
}

/** Ce qui se publie d'un evenement : la classe, la source, l'adresse, le jour, le code HTTP, les empreintes. */
const reduire = (e) => ({
	classe: e.classe,
	source: e.source,
	url: e.url,
	date: e.date,
	http: Number.isInteger(e.http) ? e.http : null,
	avant: { jour: JOUR.test(e.avant.jour ?? '') ? e.avant.jour : null, sha256: e.avant.sha256 },
	apres: HEX64.test(e.apres?.sha256 ?? '') ? { jour: e.apres.jour ?? null, sha256: e.apres.sha256 } : null
});

/** Les evenements publiables d'une liste, reduits a ce qui se publie, dans l'ordre recu. */
export const publiables = (evenements) => (Array.isArray(evenements) ? evenements.filter(publiable).map(reduire) : []);

/** Le site d'une adresse : son hote, sans `www.`. */
export const siteDe = (url) => new URL(url).hostname.toLowerCase().replace(/^www\./, '');

/**
 * Les entrees de la page : publiables, dont l'empreinte d'avant est dans le
 * journal publie (`servie`), une seule par classe et adresse, les plus recentes
 * d'abord.
 */
export function entreesDe(jours, servie = () => true) {
	const vues = new Set();
	const entrees = [];
	for (const e of jours.flatMap((j) => publiables(j?.evenements))) {
		const cle = `${e.classe}|${e.url}|${e.avant.sha256}`;
		if (vues.has(cle) || !servie(e.avant.sha256)) continue;
		vues.add(cle);
		entrees.push({ ...e, site: siteDe(e.url) });
	}
	return entrees.sort((a, b) => (a.date === b.date ? a.url.localeCompare(b.url) : a.date < b.date ? 1 : -1));
}

/** Les sites, par nombre d'entrees decroissant puis par nom. */
export function sitesDe(entrees) {
	const parSite = new Map();
	for (const e of entrees) parSite.set(e.site, (parSite.get(e.site) ?? 0) + 1);
	return [...parSite].map(([site, n]) => ({ site, n })).sort((a, b) => b.n - a.n || a.site.localeCompare(b.site));
}
