// Un acte de collectivite (D-165) : la demande, le code de la collectivite, la
// nature de l'acte et son rattachement au site officiel. Pur : ni reseau, ni base.
//
// Un acte est un depot du temoin d'URL, jamais une empreinte declaree : seul le
// service a lu ce que l'adresse servait. Sa ligne publique reste celle de tout
// depot, a quatre champs ; la collectivite et la nature vivent dans le recu, et
// dans la serie de la collectivite quand l'acte y est rattache.

import { nommeUnePersonne } from './personne.mjs';

/** Les natures d'un acte, et leur nom affiche. */
export const NATURES = { deliberation: 'délibération', arrete: 'arrêté', decision: 'décision' };

// Departement 01 a 95 (20 n'existe plus : 2A et 2B), outre-mer 97 et 98.
const INSEE = /^(?:0[1-9]|1\d|2[1-9AB]|[3-8]\d|9[0-8])\d{3}$/;
const SIREN = /^\d{9}$/;

/** Vrai pour un code commune INSEE a 5 caracteres. */
export const estUnInsee = (code) => INSEE.test(code);

/** Vrai pour un SIREN a 9 chiffres dont la cle de Luhn est juste. */
export function estUnSiren(code) {
	if (!SIREN.test(code)) return false;
	let somme = 0;
	for (let i = 0; i < 9; i++) {
		const d = Number(code[8 - i]) * (i % 2 ? 2 : 1);
		somme += d > 9 ? d - 9 : d;
	}
	return somme % 10 === 0;
}

const texte = (v) => (typeof v === 'string' ? v.trim() : v);

/**
 * Lit les champs propres a un acte. Rend `{ collectivite, nature }`, ou null
 * quand la demande n'est pas un acte ; chaque defaut s'ajoute a `erreurs`. Son
 * objet (`libelle`) est requis : un acte sans objet ne se retrouve pas.
 */
export function lireActe(corps, erreurs) {
	const type = texte(corps.type);
	const collectivite = texte(corps.collectivite);
	const nature = texte(corps.nature);
	if (type !== 'acte') {
		if (collectivite !== undefined || nature !== undefined) erreurs.push('collectivite, nature : seulement avec "type": "acte"');
		return null;
	}
	if (corps.url === undefined) erreurs.push('acte : l url est requise, le service lit lui-meme l acte en ligne');
	if (corps.sha256 !== undefined) erreurs.push('acte : pas de sha256 declare, seulement l url');
	const code = typeof collectivite === 'string' ? collectivite.toUpperCase().replace(/\s/g, '') : collectivite;
	if (!(typeof code === 'string' && (estUnInsee(code) || estUnSiren(code)))) erreurs.push('collectivite : code commune INSEE (5 caracteres) ou SIREN (9 chiffres)');
	if (!Object.hasOwn(NATURES, nature ?? '')) erreurs.push(`nature : ${Object.keys(NATURES).join(', ')}`);
	const objet = typeof corps.libelle === 'string' ? corps.libelle.trim() : '';
	if (!objet) erreurs.push('objet : requis pour un acte');
	else if (nommeUnePersonne(objet)) erreurs.push('libelle : aucun nom de personne');
	return { collectivite: code, nature };
}

/** L'hote d'une adresse, en minuscules, sans le « www. » de tete ni le point final. */
export const hoteDe = (url) => new URL(url).hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');

/**
 * Vrai quand l'adresse est sur l'un des sites officiels de la collectivite.
 * Un site est `[hote, prefixe]` : sans prefixe, l'hote lui-meme ou l'un de ses
 * sous-domaines ; avec, le meme hote et un chemin qui commence par le prefixe
 * (une plateforme ou plusieurs communes vivent sous un meme hote).
 */
export function surSiteOfficiel(url, sites) {
	let hote;
	let chemin;
	try {
		hote = hoteDe(url);
		chemin = new URL(url).pathname;
	} catch {
		return false;
	}
	return (sites ?? []).some(([site, prefixe]) =>
		prefixe ? hote === site && (chemin === prefixe || chemin.startsWith(`${prefixe}/`)) : hote === site || hote.endsWith(`.${site}`)
	);
}
