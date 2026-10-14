// La preuve d'affichage d'un permis de construire (D-166) : une photo par jour
// du panneau sur le terrain, dont seule l'empreinte entre au registre, le
// numero du permis en libelle. Pur : ni reseau, ni base.
//
// La photo ne quitte jamais le telephone : un affichage est une empreinte
// DECLAREE, jamais un temoin d'URL. Sa ligne publique reste celle de tout
// depot, a quatre champs ; le numero vit dans le recu, version 3. Le registre
// ne tient aucune serie et ne borne pas les depots d'un meme numero : un tiers
// qui lit le numero sur le panneau prendrait sinon la place du petitionnaire.

import { nommeUnePersonne } from './personne.mjs';

/** Les autorisations d'urbanisme dont le panneau porte un numero. */
export const TYPES_DE_PERMIS = ['PC', 'PA', 'PD', 'DP'];

// Type, departement (3 chiffres, ou 02A et 02B), commune (3), annee (2), division et rang (5).
const FORME = /^(PC|PA|PD|DP)(\d{3}|02[AB])(\d{3})(\d{2})([A-Z0-9]\d{4})$/;
const SEPARATEURS = /[\s.\-_/]/g;

/** Metropole 001 a 095 sauf 020 (la Corse est 02A et 02B), outre-mer 971 a 976. */
function departementExiste(code) {
	if (code === '02A' || code === '02B') return true;
	const n = Number(code);
	return (n >= 1 && n <= 95 && n !== 20) || (n >= 971 && n <= 976);
}

/** Le numero d'un permis tel qu'un panneau l'imprime, remis en forme ; null s'il n'en a pas la forme. */
export function numeroDePermis(saisie) {
	if (typeof saisie !== 'string') return null;
	const m = FORME.exec(saisie.toUpperCase().replace(SEPARATEURS, ''));
	if (!m || !departementExiste(m[2])) return null;
	return m.slice(1).join(' ');
}

/**
 * Lit les champs propres a un affichage. Rend `{ permis }`, le numero remis en
 * forme, ou null quand la demande n'est pas un affichage ; chaque defaut
 * s'ajoute a `erreurs`.
 */
export function lireAffichage(corps, erreurs) {
	if ((typeof corps.type === 'string' ? corps.type.trim() : corps.type) !== 'affichage') return null;
	if (corps.sha256 === undefined) erreurs.push('affichage : le sha256 de la photo est requis, la photo reste sur le telephone');
	if (corps.url !== undefined) erreurs.push('affichage : pas d url, seulement le sha256');
	if (typeof corps.libelle === 'string' && nommeUnePersonne(corps.libelle)) erreurs.push('libelle : aucun nom de personne');
	const permis = numeroDePermis(corps.libelle);
	if (!permis) erreurs.push('libelle : le numero du permis tel que le panneau l imprime, PC 069 123 24 A0001');
	return permis ? { permis } : null;
}
