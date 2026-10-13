// Ce que la surface sert a un hote : les pages francaises telles quelles sur
// temoinpublic.fr, les pages allemandes de `dist/de/` sur datumszeuge.de, et
// jamais `/de/` en clair. Pur ; la Function `_middleware.js` branche les actifs.

import { EDITIONS, HOTES_ALLEMANDS, langueDe, planDe } from './edition.mjs';

/** Les chemins servis par une Function, dans toute langue : la decision leur est laissee. */
export const FONCTIONS = ['/api/', '/recu/', '/editeur/', '/depots/', '/health'];

/** Ce qui n'existe qu'en francais : l'edition allemande y renvoie. */
const FRANCAIS = ['/acte', '/collectivite/', '/mentions-legales'];

const FICHIERS = ['/sitemap.xml', '/robots.txt', '/llms.txt'];

/** Le fichier de `dist/` qui porte un chemin de l'edition allemande, ou null. */
export function pageAllemande(chemin) {
	if (chemin === '/') return '/de/';
	if (FICHIERS.includes(chemin)) return `/de${chemin}`;
	return planDe('de').includes(chemin) ? `/de${chemin}` : null;
}

const sous = (chemin, prefixes) => prefixes.some((p) => (p.endsWith('/') ? chemin.startsWith(p) : chemin === p || chemin.startsWith(`${p}/`)));

/**
 * La decision pour une adresse : `{ action: 'suivant' }` laisse la requete a la
 * surface ; `statique` sert un fichier de `dist/` ; `redirection` renvoie vers
 * `vers` ; `introuvable` sert la page 404 de `langue`.
 */
export function decider(url) {
	const u = new URL(url);
	const hote = u.hostname.toLowerCase();
	const chemin = u.pathname;
	const langue = langueDe(hote);
	if (hote === 'www.datumszeuge.de') return { action: 'redirection', vers: `${EDITIONS.de.adresse}${chemin}${u.search}` };
	if (chemin.startsWith('/de/') || chemin === '/de') return { action: 'introuvable', langue };
	if (langue === 'fr') return { action: 'suivant' };
	const statique = pageAllemande(chemin);
	if (statique) return { action: 'statique', chemin: statique };
	if (sous(chemin, FONCTIONS)) return { action: 'suivant' };
	if (sous(chemin, FRANCAIS)) return { action: 'redirection', vers: `${EDITIONS.fr.adresse}${chemin}${u.search}` };
	return { action: 'introuvable', langue };
}

/** Vrai pour un hote de controle de Cloudflare Pages : il ne s'indexe pas. */
export const horsIndex = (url) => new URL(url).hostname.endsWith('.pages.dev');

export { HOTES_ALLEMANDS };
